import { calculateCriticalPathIds } from "@/lib/intelligence/critical-path";
import { prisma } from "@/lib/prisma";
import type { Person, Project, User, WorkPackage, WorkspaceSnapshot } from "@/lib/types";
import { ServiceError } from "./auth-context";
import { loadWorkspaceSnapshot } from "./workspace";

export type PlanNodeShape = "milestone" | "task";
export type PlanDifficulty = "low" | "medium" | "high" | "critical";
export type PlanRiskLevel = "low" | "medium" | "high";
export type PlanScenarioStatus = "draft" | "proposed" | "applied" | "discarded";
export type PlanChangeType =
  | "node.move"
  | "node.add"
  | "node.delete"
  | "node.update"
  | "node.difficulty"
  | "phase.add"
  | "phase.delete"
  | "phase.update"
  | "dependency.add"
  | "dependency.delete"
  | "task.upsert"
  | "task.delete"
  | "ai.merge";

export interface PlanTask {
  id: string;
  title: string;
  ownerLabel: string;
  ownerPersonId?: string;
  startDate?: string;
  endDate?: string;
  estimateHours?: number;
  difficulty?: PlanDifficulty;
  riskLevel?: PlanRiskLevel;
  isBlocked?: boolean;
  progress: number;
  status: "todo" | "in_progress" | "done";
  workPackageId?: number;
}

export interface PlanNode {
  id: string;
  phaseId: string;
  shape: PlanNodeShape;
  label: string;
  title: string;
  date: string;
  startDate?: string;
  endDate?: string;
  estimateHours?: number;
  difficulty: PlanDifficulty;
  difficultyScore?: number;
  riskLevel?: PlanRiskLevel;
  isBlocked?: boolean;
  progress: number;
  ownerLabel?: string;
  ownerPersonId?: string;
  tasks: PlanTask[];
  workPackageId?: number;
  isOnCriticalPath: boolean;
}

export interface PlanPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  difficulty: PlanDifficulty;
  difficultyScore?: number;
  effortHours?: number;
  criticalPathRatio?: number;
  riskRatio?: number;
  blockedRatio?: number;
  summary: string;
  ownerLabel?: string;
  ownerPersonId?: string;
  workPackageId?: number;
  riskCount: number;
  taskCount: number;
}

export interface PlanDependency {
  fromNodeId: string;
  toNodeId: string;
  isCritical: boolean;
}

export interface PlanModel {
  projectId: string;
  projectName: string;
  projectCode: string;
  subtitle: string;
  statusBadge: string;
  progress: number;
  projectDifficulty: PlanDifficulty;
  projectDifficultyScore?: number;
  initialDifficulty?: PlanDifficulty;
  difficultyOverride?: PlanDifficulty;
  startDate: string;
  endDate: string;
  today: string;
  phases: PlanPhase[];
  nodes: PlanNode[];
  dependencies: PlanDependency[];
}

export interface PlanScenarioSummary {
  id: string;
  name: string;
  status: PlanScenarioStatus;
  baselineId: string | null;
  agentSummary?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanBaselineSummary {
  id: string;
  version: number;
  appliedByUserId: string | null;
  appliedAt: string;
}

export interface ScreenPlanResponse {
  baseline: { plan: PlanModel; summary: PlanBaselineSummary } | null;
  scenarios: PlanScenarioSummary[];
  activeScenario: { plan: PlanModel; summary: PlanScenarioSummary } | null;
  /** Whichever plan is currently driving the canvas: scenario draft if active, otherwise baseline. */
  plan: PlanModel;
  source: "scenario" | "baseline";
}

export interface PlanChangeInput {
  type: PlanChangeType;
  targetRef: string;
  payload: Record<string, unknown>;
}

const PLAN_SCHEMA_VERSION = 1;

/**
 * Loads or initialises a baseline + active scenario for the requested project.
 */
export async function loadScreenPlan(options: {
  projectId: string;
  scenarioId?: string;
  user?: User;
  anonymousFallback?: boolean;
}): Promise<ScreenPlanResponse> {
  const { snapshot } = await loadWorkspaceSnapshot(
    options.user ? { userId: options.user.id } : {}
  );
  const project = resolveVisibleProject(snapshot.projects, options.projectId, options.user, options.anonymousFallback);

  const baselinePlan = derivePlanMetrics(buildPlanFromWorkspace(project, snapshot));
  const baselineRow = await ensureBaseline(project.id, baselinePlan);
  const baselineSummary: PlanBaselineSummary = {
    id: baselineRow.id,
    version: baselineRow.version,
    appliedByUserId: baselineRow.appliedByUserId,
    appliedAt: baselineRow.appliedAt.toISOString()
  };

  const scenarios = await prisma.scheduleScenario.findMany({
    where: { projectId: project.id, status: { in: ["DRAFT", "PROPOSED"] } },
    orderBy: { updatedAt: "desc" }
  });

  const activeScenarioRow = options.scenarioId
    ? scenarios.find((scenario) => scenario.id === options.scenarioId) ?? null
    : null;

  const activeScenario = activeScenarioRow
    ? {
        plan: derivePlanMetrics(parsePlanJson(activeScenarioRow.draftJson, baselinePlan)),
        summary: scenarioToSummary(activeScenarioRow)
      }
    : null;

  return {
    baseline: { plan: baselinePlan, summary: baselineSummary },
    scenarios: scenarios.map(scenarioToSummary),
    activeScenario,
    plan: activeScenario?.plan ?? baselinePlan,
    source: activeScenario ? "scenario" : "baseline"
  };
}

/**
 * Creates a new draft scenario forked from the current baseline.
 */
export async function createScenario(options: {
  projectId: string;
  user: User;
  name?: string;
}) {
  const { snapshot } = await loadWorkspaceSnapshot({ userId: options.user.id });
  const project = resolveVisibleProject(snapshot.projects, options.projectId, options.user);
  const baselinePlan = derivePlanMetrics(buildPlanFromWorkspace(project, snapshot));
  const baseline = await ensureBaseline(project.id, baselinePlan);

  return prisma.scheduleScenario.create({
    data: {
      projectId: project.id,
      baselineId: baseline.id,
      name: options.name ?? `计划草稿 ${new Date().toLocaleString("zh-CN")}`,
      status: "DRAFT",
      createdByUserId: options.user.id,
      draftJson: serializePlan(baselinePlan)
    }
  });
}

/**
 * Applies a batch of changes to the scenario draft and records each change.
 */
export async function patchScenario(options: {
  scenarioId: string;
  user: User;
  changes: PlanChangeInput[];
  nextDraft: PlanModel;
}) {
  const scenario = await prisma.scheduleScenario.findUnique({ where: { id: options.scenarioId } });
  if (!scenario) {
    throw new ServiceError("场景不存在。", 404);
  }
  if (scenario.status !== "DRAFT" && scenario.status !== "PROPOSED") {
    throw new ServiceError("已应用或已废弃的场景不能再编辑。", 409);
  }

  const nextDraft = derivePlanMetrics(options.nextDraft);

  await prisma.$transaction(async (tx) => {
    await tx.scheduleScenario.update({
      where: { id: scenario.id },
      data: { draftJson: serializePlan(nextDraft) }
    });

    for (const change of options.changes) {
      await tx.scheduleChange.create({
        data: {
          scenarioId: scenario.id,
          changeType: change.type,
          targetRef: change.targetRef,
          payloadJson: JSON.stringify(change.payload ?? {})
        }
      });
    }
  });

  await recordQualitySnapshot({
    plan: nextDraft,
    source: "DRAFT",
    scenarioId: scenario.id,
    createdByUserId: options.user.id
  });

  return nextDraft;
}

/**
 * Materialises the scenario draft back to WorkPackage rows and bumps a new baseline.
 */
export async function applyScenario(options: { scenarioId: string; user: User }) {
  const scenario = await prisma.scheduleScenario.findUnique({ where: { id: options.scenarioId } });
  if (!scenario) {
    throw new ServiceError("场景不存在。", 404);
  }
  if (scenario.status === "APPLIED" || scenario.status === "DISCARDED") {
    throw new ServiceError("场景已经处于终态。", 409);
  }

  const parsedDraft = parsePlanJson(scenario.draftJson, null);
  if (!parsedDraft) {
    throw new ServiceError("场景的草稿数据无效。", 422);
  }
  const draft = derivePlanMetrics(parsedDraft);

  const baselineVersion = await nextBaselineVersion(scenario.projectId);

  const baseline = await prisma.$transaction(async (tx) => {
    for (const phase of draft.phases) {
      if (typeof phase.workPackageId === "number") {
        await tx.workPackage.update({
          where: { id: phase.workPackageId },
          data: {
            subject: phase.name,
            startDate: new Date(phase.startDate),
            dueDate: new Date(phase.endDate),
            percentComplete: phase.progress,
            difficulty: toStoredDifficulty(phase.difficulty)
          }
        });
      }
    }

    for (const node of draft.nodes) {
      if (typeof node.workPackageId === "number") {
        await tx.workPackage.update({
          where: { id: node.workPackageId },
          data: {
            subject: node.title,
            startDate: node.startDate ? new Date(node.startDate) : null,
            dueDate: new Date(node.endDate ?? node.date),
            estimateHours: node.estimateHours,
            percentComplete: node.progress,
            difficulty: toStoredDifficulty(node.difficulty),
            riskLevel: node.riskLevel ? toStoredRiskLevel(node.riskLevel) : null,
            status: node.isBlocked ? "blocked" : statusFromProgress(node.progress, node.shape),
            isOnCriticalPath: node.isOnCriticalPath
          }
        });
      }
    }

    await tx.project.update({
      where: { id: draft.projectId },
      data: {
        progress: draft.progress,
        startDate: new Date(draft.startDate),
        endDate: new Date(draft.endDate)
      }
    });

    const nextBaseline = await tx.scheduleBaseline.create({
      data: {
        projectId: scenario.projectId,
        version: baselineVersion,
        snapshotJson: serializePlan(draft),
        appliedByUserId: options.user.id
      }
    });

    await tx.scheduleScenario.update({
      where: { id: scenario.id },
      data: { status: "APPLIED", appliedAt: new Date() }
    });

    return nextBaseline;
  });

  await recordQualitySnapshot({
    plan: draft,
    source: "APPLIED",
    scenarioId: scenario.id,
    baselineId: baseline.id,
    createdByUserId: options.user.id
  });
}

/**
 * Discards a scenario without writing back to WorkPackage.
 */
export async function discardScenario(options: { scenarioId: string }) {
  const scenario = await prisma.scheduleScenario.findUnique({ where: { id: options.scenarioId } });
  if (!scenario) {
    throw new ServiceError("场景不存在。", 404);
  }
  await prisma.scheduleScenario.update({
    where: { id: scenario.id },
    data: { status: "DISCARDED" }
  });
}

/**
 * Lists all change events recorded against a scenario.
 */
export async function listScenarioChanges(scenarioId: string) {
  return prisma.scheduleChange.findMany({
    where: { scenarioId },
    orderBy: { createdAt: "desc" },
    take: 200
  });
}

/* ----------------------- Plan model construction ----------------------- */

function resolveVisibleProject(
  projects: Project[],
  projectId: string,
  user?: User,
  anonymousFallback?: boolean
): Project {
  const project = projects.find((item) => item.id === projectId || item.identifier === projectId);
  if (!project) {
    throw new ServiceError("项目不存在或当前用户不可见。", 404);
  }
  if (anonymousFallback) {
    return project;
  }
  if (user && user.role !== "admin" && !user.participatingProjectIds.includes(project.id)) {
    throw new ServiceError("当前用户无权查看该项目大屏。", 403);
  }
  return project;
}

function buildPlanFromWorkspace(project: Project, snapshot: WorkspaceSnapshot): PlanModel {
  const items = snapshot.workPackages.filter((wp) => wp.projectId === project.id);
  const peopleMap = new Map(snapshot.people.map((person) => [person.id, person]));
  const criticalPathIds = calculateCriticalPathIds(items);

  const datedItems = items.filter((wp) => wp.startDate || wp.dueDate);
  const projectStart = project.startDate ?? minDate(datedItems) ?? new Date().toISOString();
  const projectEnd = project.endDate ?? maxDate(datedItems) ?? projectStart;

  const phaseItems = items.filter((wp) => wp.type === "phase");
  const fallbackPhase: WorkPackage | null =
    phaseItems.length === 0
      ? {
          id: 0,
          projectId: project.id,
          type: "phase",
          subject: "总体计划",
          description: project.description ?? "",
          status: "active",
          priority: "P1",
          origin: "manager",
          createdByUserId: "",
          percentComplete: project.progress,
          lastProgressNote: "",
          dependencies: [],
          startDate: projectStart,
          dueDate: projectEnd
        }
      : null;
  const phaseSources = fallbackPhase ? [fallbackPhase] : phaseItems;

  const phases: PlanPhase[] = phaseSources.map((phase) => buildPhase(phase, items, peopleMap));
  const nodes: PlanNode[] = [];
  for (const phase of phaseSources) {
    const phaseId = String(phase.id);
    const childItems = items.filter((wp) => wp.parentId === phase.id);
    const milestones = childItems.length
      ? childItems.filter((wp) => wp.type === "milestone")
      : items.filter((wp) => wp.type === "milestone");
    const tasks = childItems.length
      ? childItems.filter((wp) => wp.type !== "milestone" && wp.type !== "phase")
      : items.filter((wp) => wp.type === "task" || wp.type === "risk");

    for (const milestone of milestones) {
      const owner = milestone.assigneeId ? peopleMap.get(milestone.assigneeId) : undefined;
      nodes.push({
        id: `wp-${milestone.id}`,
        phaseId,
        shape: "milestone",
        label: milestoneLabel(milestone.subject, nodes.length),
        title: milestone.subject,
        date: (milestone.dueDate ?? milestone.startDate ?? phase.dueDate ?? projectEnd) as string,
        difficulty: difficultyFromWorkPackage(milestone),
        estimateHours: milestone.estimateHours,
        riskLevel: riskLevelFromWorkPackage(milestone),
        isBlocked: isBlockedWorkPackage(milestone),
        progress: milestone.percentComplete,
        ownerLabel: owner?.name,
        ownerPersonId: owner?.id,
        tasks: [],
        workPackageId: milestone.id,
        isOnCriticalPath: milestone.isOnCriticalPath ?? criticalPathIds.has(milestone.id)
      });
    }

    for (const task of tasks) {
      const owner = task.assigneeId ? peopleMap.get(task.assigneeId) : undefined;
      const start = (task.startDate ?? task.dueDate ?? phase.startDate ?? projectStart) as string;
      const end = (task.dueDate ?? task.startDate ?? phase.dueDate ?? projectEnd) as string;
      nodes.push({
        id: `wp-${task.id}`,
        phaseId,
        shape: "task",
        label: shortLabel(task.subject),
        title: task.subject,
        date: end,
        startDate: start,
        endDate: end,
        difficulty: difficultyFromWorkPackage(task),
        estimateHours: task.estimateHours,
        riskLevel: riskLevelFromWorkPackage(task),
        isBlocked: isBlockedWorkPackage(task),
        progress: task.percentComplete,
        ownerLabel: owner?.name,
        ownerPersonId: owner?.id,
        tasks: [
          {
            id: `wp-task-${task.id}`,
            title: task.subject,
            ownerLabel: owner?.name ?? "未分配",
            ownerPersonId: owner?.id,
            startDate: start,
            endDate: end,
            estimateHours: task.estimateHours,
            difficulty: difficultyFromWorkPackage(task),
            riskLevel: riskLevelFromWorkPackage(task),
            isBlocked: isBlockedWorkPackage(task),
            progress: task.percentComplete,
            status: normalizeTaskStatus(task.status),
            workPackageId: task.id
          }
        ],
        workPackageId: task.id,
        isOnCriticalPath: task.isOnCriticalPath ?? criticalPathIds.has(task.id)
      });
    }
  }

  const dependencies: PlanDependency[] = [];
  const idToNode = new Map(nodes.map((node) => [node.workPackageId ?? -1, node] as const));
  for (const item of items) {
    const target = idToNode.get(item.id);
    if (!target) continue;
    for (const dep of item.dependencies ?? []) {
      const source = idToNode.get(dep);
      if (!source) continue;
      dependencies.push({
        fromNodeId: source.id,
        toNodeId: target.id,
        isCritical: source.isOnCriticalPath && target.isOnCriticalPath
      });
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.identifier.toUpperCase(),
    subtitle: project.description ?? "项目计划总览",
    statusBadge: statusBadge(project.status),
    progress: project.progress,
    projectDifficulty: difficultyFromProject(project),
    initialDifficulty: project.initialDifficulty,
    difficultyOverride: project.difficultyOverride,
    startDate: projectStart,
    endDate: projectEnd,
    today: new Date().toISOString(),
    phases,
    nodes,
    dependencies
  };
}

function buildPhase(
  phase: WorkPackage,
  items: WorkPackage[],
  peopleMap: Map<string, Person>
): PlanPhase {
  const owner = phase.assigneeId ? peopleMap.get(phase.assigneeId) : undefined;
  const phaseChildren = items.filter((wp) => wp.parentId === phase.id);
  const taskCount = phaseChildren.filter((wp) => wp.type === "task" || wp.type === "milestone").length;
  const riskCount = phaseChildren.filter((wp) => wp.type === "risk" || wp.riskLevel === "High").length;
  const summary = phase.lastProgressNote || phase.description || "按计划推进";

  return {
    id: String(phase.id),
    name: phase.subject,
    startDate: phase.startDate ?? new Date().toISOString(),
    endDate: phase.dueDate ?? new Date().toISOString(),
    progress: phase.percentComplete,
    difficulty: difficultyFromWorkPackage(phase),
    summary: summary.split(/[；;\n]/)[0]?.slice(0, 60) ?? "按计划推进",
    ownerLabel: owner?.name,
    ownerPersonId: owner?.id,
    workPackageId: phase.id,
    riskCount,
    taskCount
  };
}

export function derivePlanMetrics(plan: PlanModel): PlanModel {
  const nodes = plan.nodes.map((node) => {
    const tasks = node.tasks.map((task) => ({
      ...task,
      progress: clampProgress(task.progress),
      difficulty: task.difficulty ?? node.difficulty,
      status: inferTaskStatus(clampProgress(task.progress))
    }));
    const taskProgressValues = tasks.map((task) => task.progress);
    const taskStart = minIso(...tasks.map((task) => task.startDate).filter(isString));
    const taskEnd = maxIso(...tasks.map((task) => task.endDate ?? task.startDate).filter(isString));
    const startDate = node.shape === "task"
      ? taskStart ?? node.startDate ?? node.date
      : node.date;
    const endDate = node.shape === "task"
      ? taskEnd ?? node.endDate ?? node.date
      : node.date;
    const nextDate = node.shape === "milestone" ? node.date : endDate;
    const progress = taskProgressValues.length
      ? averageProgress(taskProgressValues)
      : clampProgress(node.progress);
    const riskLevel = node.riskLevel ?? highestRiskLevel(tasks.map((task) => task.riskLevel));
    const isBlocked = Boolean(node.isBlocked || tasks.some((task) => task.isBlocked));
    const estimateHours = node.estimateHours ?? sumEstimateHours(tasks);

    return {
      ...node,
      tasks,
      estimateHours,
      riskLevel,
      isBlocked,
      startDate,
      endDate,
      date: nextDate,
      progress,
      difficultyScore: DIFFICULTY_BASE_SCORE[node.difficulty],
      difficulty: node.difficulty
    };
  });

  const phases = plan.phases.map((phase) => {
    const phaseNodes = nodes.filter((node) => node.phaseId === phase.id);
    const progress = phaseNodes.length
      ? averageProgress(phaseNodes.map((node) => node.progress))
      : clampProgress(phase.progress);
    const startDate = minIso(...phaseNodes.map((node) => node.startDate ?? node.date).filter(isString)) ?? phase.startDate;
    const endDate = maxIso(...phaseNodes.map((node) => node.endDate ?? node.date).filter(isString)) ?? phase.endDate;
    const score = calculateCompositeDifficulty(
      phaseNodes.map((node) => ({
        difficulty: node.difficulty,
        effortHours: nodeEffortHours(node),
        isCritical: node.isOnCriticalPath,
        riskSeverity: riskSeverity(node.riskLevel),
        isBlocked: node.isBlocked
      })),
      phase.difficulty
    );
    return {
      ...phase,
      startDate,
      endDate,
      progress,
      difficulty: score.difficulty,
      difficultyScore: score.score,
      effortHours: score.effortHours,
      criticalPathRatio: score.criticalPathRatio,
      riskRatio: score.riskRatio,
      blockedRatio: score.blockedRatio,
      taskCount: phaseNodes.length
    };
  });

  const progress = phases.length
    ? averageProgress(phases.map((phase) => phase.progress))
    : clampProgress(plan.progress ?? 0);
  const startDate = minIso(...phases.map((phase) => phase.startDate).filter(isString)) ?? plan.startDate;
  const endDate = maxIso(...phases.map((phase) => phase.endDate).filter(isString)) ?? plan.endDate;
  const projectScore = calculateCompositeDifficulty(
    phases.map((phase) => ({
      difficulty: phase.difficulty,
      effortHours: phase.effortHours ?? 1,
      isCritical: (phase.criticalPathRatio ?? 0) > 0,
      riskSeverity: phase.riskRatio,
      isBlocked: (phase.blockedRatio ?? 0) > 0
    })),
    plan.projectDifficulty
  );

  return {
    ...plan,
    progress,
    projectDifficulty: projectScore.difficulty,
    projectDifficultyScore: projectScore.score,
    startDate,
    endDate,
    phases,
    nodes
  };
}

function difficultyFromWorkPackage(item: WorkPackage): PlanDifficulty {
  if (item.difficulty) return item.difficulty;
  if (item.riskLevel === "High" && item.priority === "P0") return "critical";
  if (item.riskLevel === "High") return "high";
  if (item.riskLevel === "Medium" && item.priority === "P0") return "high";
  if (item.priority === "P0") return "medium";
  if (item.priority === "P1") return "medium";
  return "low";
}

function difficultyFromProject(project: Project): PlanDifficulty {
  return project.difficultyOverride ?? project.initialDifficulty ?? riskLevelToDifficulty(project.health);
}

function riskLevelToDifficulty(level: Project["health"]): PlanDifficulty {
  if (level === "High") return "high";
  if (level === "Medium") return "medium";
  return "low";
}

function riskLevelFromWorkPackage(item: WorkPackage): PlanRiskLevel | undefined {
  if (item.riskLevel === "High") return "high";
  if (item.riskLevel === "Medium") return "medium";
  if (item.riskLevel === "Low") return "low";
  return undefined;
}

function isBlockedWorkPackage(item: WorkPackage): boolean {
  return ["blocked", "atRisk", "open"].includes(item.status);
}

function shortLabel(subject: string): string {
  const matched = subject.match(/\b[A-Z]\d+\b/);
  if (matched) return matched[0];
  return subject.slice(0, 4);
}

function milestoneLabel(subject: string, index: number): string {
  const matched = subject.match(/\bM\d+\b/i);
  return matched?.[0].toUpperCase() ?? `M${index + 1}`;
}

function normalizeTaskStatus(status: string): PlanTask["status"] {
  if (["done", "completed", "achieved", "closed"].includes(status)) return "done";
  if (["inProgress", "review", "active", "mitigating"].includes(status)) return "in_progress";
  return "todo";
}

function statusBadge(status: Project["status"]) {
  if (status === "active") return "执行中";
  if (status === "onHold") return "暂停";
  return "已归档";
}

function minDate(items: WorkPackage[]): string | undefined {
  return pickDate(items, Math.min, "start");
}

function maxDate(items: WorkPackage[]): string | undefined {
  return pickDate(items, Math.max, "end");
}

function pickDate(items: WorkPackage[], picker: (...values: number[]) => number, mode: "start" | "end") {
  const dates = items
    .map((wp) => (mode === "start" ? wp.startDate ?? wp.dueDate : wp.dueDate ?? wp.startDate))
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return dates.length ? new Date(picker(...dates)).toISOString() : undefined;
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value || 0)));
}

function averageProgress(values: number[]): number {
  if (!values.length) return 0;
  return clampProgress(values.reduce((sum, value) => sum + value, 0) / values.length);
}

interface CompositeDifficultyInput {
  difficulty: PlanDifficulty;
  effortHours?: number;
  isCritical?: boolean;
  riskSeverity?: number;
  isBlocked?: boolean;
}

interface CompositeDifficultyScore {
  difficulty: PlanDifficulty;
  score: number;
  effortHours: number;
  criticalPathRatio: number;
  riskRatio: number;
  blockedRatio: number;
}

/**
 * Scores delivery complexity using weighted base difficulty plus amplifiers
 * for critical-path, risk exposure, and blocked work. Ratios are effort-based
 * so one large hard node outweighs many tiny easy nodes.
 */
function calculateCompositeDifficulty(
  items: CompositeDifficultyInput[],
  fallback: PlanDifficulty = "medium"
): CompositeDifficultyScore {
  if (!items.length) {
    return {
      difficulty: fallback,
      score: DIFFICULTY_BASE_SCORE[fallback],
      effortHours: 0,
      criticalPathRatio: 0,
      riskRatio: 0,
      blockedRatio: 0
    };
  }

  const normalized = items.map((item) => ({ ...item, effortHours: Math.max(1, item.effortHours ?? 1) }));
  const totalEffort = normalized.reduce((sum, item) => sum + item.effortHours, 0);
  const baseScore = normalized.reduce(
    (sum, item) => sum + DIFFICULTY_BASE_SCORE[item.difficulty] * (item.effortHours / totalEffort),
    0
  );
  const criticalPathRatio = normalized.reduce(
    (sum, item) => sum + (item.isCritical ? item.effortHours : 0),
    0
  ) / totalEffort;
  const riskRatio = normalized.reduce(
    (sum, item) => sum + Math.max(0, Math.min(1, item.riskSeverity ?? 0)) * item.effortHours,
    0
  ) / totalEffort;
  const blockedRatio = normalized.reduce(
    (sum, item) => sum + (item.isBlocked ? item.effortHours : 0),
    0
  ) / totalEffort;
  const score = clampScore(baseScore + criticalPathRatio * 10 + riskRatio * 10 + blockedRatio * 10);

  return {
    difficulty: difficultyFromScore(score),
    score,
    effortHours: totalEffort,
    criticalPathRatio,
    riskRatio,
    blockedRatio
  };
}

const DIFFICULTY_BASE_SCORE: Record<PlanDifficulty, number> = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100
};

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function minIso(...values: string[]): string | undefined {
  return pickIso(values, Math.min);
}

function maxIso(...values: string[]): string | undefined {
  return pickIso(values, Math.max);
}

function pickIso(values: string[], picker: (...values: number[]) => number): string | undefined {
  const times = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  return times.length ? new Date(picker(...times)).toISOString() : undefined;
}

function inferTaskStatus(progress: number): PlanTask["status"] {
  if (progress >= 100) return "done";
  if (progress > 0) return "in_progress";
  return "todo";
}

function difficultyFromScore(score: number): PlanDifficulty {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function riskSeverity(level?: PlanRiskLevel): number {
  if (level === "high") return 1;
  if (level === "medium") return 0.6;
  if (level === "low") return 0.2;
  return 0;
}

function highestRiskLevel(values: Array<PlanRiskLevel | undefined>): PlanRiskLevel | undefined {
  if (values.includes("high")) return "high";
  if (values.includes("medium")) return "medium";
  if (values.includes("low")) return "low";
  return undefined;
}

function sumEstimateHours(tasks: PlanTask[]): number | undefined {
  const total = tasks.reduce((sum, task) => sum + (task.estimateHours ?? 0), 0);
  return total > 0 ? total : undefined;
}

function nodeEffortHours(node: PlanNode): number {
  return Math.max(1, node.estimateHours ?? sumEstimateHours(node.tasks) ?? node.tasks.length ?? 1);
}

function toStoredDifficulty(value: PlanDifficulty): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  return value.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

function toStoredRiskLevel(value: PlanRiskLevel): "LOW" | "MEDIUM" | "HIGH" {
  return value.toUpperCase() as "LOW" | "MEDIUM" | "HIGH";
}

function statusFromProgress(progress: number, shape: PlanNodeShape): string {
  if (shape === "milestone") return progress >= 100 ? "achieved" : "planned";
  if (progress >= 100) return "done";
  if (progress > 0) return "inProgress";
  return "todo";
}

async function recordQualitySnapshot(options: {
  plan: PlanModel;
  source: "BASELINE" | "DRAFT" | "APPLIED";
  scenarioId?: string;
  baselineId?: string;
  createdByUserId?: string;
}) {
  const plan = derivePlanMetrics(options.plan);
  const taskItemCount = plan.nodes.reduce((sum, node) => sum + node.tasks.length, 0);
  const metricJson = {
    progress: plan.progress,
    difficulty: plan.projectDifficulty,
    difficultyScore: plan.projectDifficultyScore,
    phases: plan.phases.length,
    nodes: plan.nodes.length,
    taskItems: taskItemCount
  };
  const aiContextJson = {
    project: {
      id: plan.projectId,
      name: plan.projectName,
      code: plan.projectCode,
      progress: plan.progress,
      difficulty: plan.projectDifficulty,
      difficultyScore: plan.projectDifficultyScore,
      startDate: plan.startDate,
      endDate: plan.endDate
    },
    phases: plan.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      progress: phase.progress,
      difficulty: phase.difficulty,
      difficultyScore: phase.difficultyScore,
      criticalPathRatio: phase.criticalPathRatio,
      riskRatio: phase.riskRatio,
      blockedRatio: phase.blockedRatio,
      startDate: phase.startDate,
      endDate: phase.endDate,
      nodeCount: plan.nodes.filter((node) => node.phaseId === phase.id).length
    })),
    nodes: plan.nodes.map((node) => ({
      id: node.id,
      phaseId: node.phaseId,
      title: node.title,
      shape: node.shape,
      progress: node.progress,
      difficulty: node.difficulty,
      difficultyScore: node.difficultyScore,
      estimateHours: node.estimateHours,
      riskLevel: node.riskLevel,
      isBlocked: node.isBlocked,
      startDate: node.startDate,
      endDate: node.endDate,
      ownerPersonId: node.ownerPersonId,
      taskItemCount: node.tasks.length
    }))
  };

  const snapshot = await prisma.projectQualitySnapshot.create({
    data: {
      projectId: plan.projectId,
      source: options.source,
      scenarioId: options.scenarioId,
      baselineId: options.baselineId,
      projectProgress: plan.progress,
      projectDifficulty: toStoredDifficulty(plan.projectDifficulty),
      startDate: new Date(plan.startDate),
      endDate: new Date(plan.endDate),
      phaseCount: plan.phases.length,
      nodeCount: plan.nodes.length,
      taskItemCount,
      metricJson: JSON.stringify(metricJson),
      aiContextJson: JSON.stringify(aiContextJson),
      createdByUserId: options.createdByUserId
    }
  });

  const metrics = buildQualityMetrics(snapshot.id, plan);
  if (metrics.length) {
    await prisma.projectQualityMetric.createMany({ data: metrics });
  }
}

function buildQualityMetrics(snapshotId: string, plan: PlanModel) {
  const rows: Array<{
    snapshotId: string;
    projectId: string;
    entityType: string;
    entityRef: string;
    metricKey: string;
    numericValue?: number;
    textValue?: string;
    difficultyValue?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    startDate?: Date;
    endDate?: Date;
    personId?: string;
    teamRef?: string;
    evidenceJson: string;
  }> = [];

  const push = (row: Omit<(typeof rows)[number], "snapshotId" | "projectId" | "evidenceJson"> & { evidence?: unknown }) => {
    rows.push({
      snapshotId,
      projectId: plan.projectId,
      ...row,
      evidenceJson: JSON.stringify(row.evidence ?? {})
    });
  };

  push({
    entityType: "project",
    entityRef: plan.projectId,
    metricKey: "progress",
    numericValue: plan.progress,
    difficultyValue: toStoredDifficulty(plan.projectDifficulty),
    startDate: new Date(plan.startDate),
    endDate: new Date(plan.endDate),
    evidence: { phaseCount: plan.phases.length, nodeCount: plan.nodes.length, score: plan.projectDifficultyScore }
  });

  for (const phase of plan.phases) {
    push({
      entityType: "phase",
      entityRef: phase.id,
      metricKey: "progress",
      numericValue: phase.progress,
      textValue: phase.name,
      difficultyValue: toStoredDifficulty(phase.difficulty),
      startDate: new Date(phase.startDate),
      endDate: new Date(phase.endDate),
      personId: phase.ownerPersonId,
      evidence: {
        riskCount: phase.riskCount,
        taskCount: phase.taskCount,
        score: phase.difficultyScore,
        criticalPathRatio: phase.criticalPathRatio,
        riskRatio: phase.riskRatio,
        blockedRatio: phase.blockedRatio
      }
    });
  }

  for (const node of plan.nodes) {
    push({
      entityType: "node",
      entityRef: node.id,
      metricKey: "progress",
      numericValue: node.progress,
      textValue: node.title,
      difficultyValue: toStoredDifficulty(node.difficulty),
      startDate: new Date(node.startDate ?? node.date),
      endDate: new Date(node.endDate ?? node.date),
      personId: node.ownerPersonId,
      evidence: {
        phaseId: node.phaseId,
        shape: node.shape,
        score: node.difficultyScore,
        estimateHours: node.estimateHours,
        riskLevel: node.riskLevel,
        isBlocked: node.isBlocked,
        isOnCriticalPath: node.isOnCriticalPath
      }
    });
    for (const task of node.tasks) {
      push({
        entityType: "task",
        entityRef: task.id,
        metricKey: "progress",
        numericValue: task.progress,
        textValue: task.title,
        difficultyValue: toStoredDifficulty(task.difficulty ?? node.difficulty),
        startDate: task.startDate ? new Date(task.startDate) : undefined,
        endDate: task.endDate ? new Date(task.endDate) : undefined,
        personId: task.ownerPersonId,
        teamRef: task.ownerLabel,
        evidence: { nodeId: node.id, phaseId: node.phaseId, status: task.status }
      });
    }
  }

  return rows;
}

/* --------------------------- Persistence helpers --------------------------- */

async function ensureBaseline(projectId: string, plan: PlanModel) {
  const existing = await prisma.scheduleBaseline.findFirst({
    where: { projectId },
    orderBy: { version: "desc" }
  });
  if (existing) {
    return existing;
  }
  return prisma.scheduleBaseline.create({
    data: {
      projectId,
      version: 1,
      snapshotJson: serializePlan(plan)
    }
  });
}

async function nextBaselineVersion(projectId: string) {
  const latest = await prisma.scheduleBaseline.findFirst({
    where: { projectId },
    orderBy: { version: "desc" }
  });
  return (latest?.version ?? 0) + 1;
}

function scenarioToSummary(row: {
  id: string;
  name: string;
  status: string;
  baselineId: string | null;
  agentSummary: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): PlanScenarioSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status.toLowerCase() as PlanScenarioStatus,
    baselineId: row.baselineId,
    agentSummary: row.agentSummary ?? undefined,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function serializePlan(plan: PlanModel): string {
  return JSON.stringify({ version: PLAN_SCHEMA_VERSION, plan });
}

function parsePlanJson<T extends PlanModel | null>(value: string, fallback: T): PlanModel | T {
  try {
    const parsed = JSON.parse(value) as { version?: number; plan?: PlanModel } | PlanModel;
    if (parsed && typeof parsed === "object" && "plan" in parsed && parsed.plan) {
      return parsed.plan;
    }
    if (parsed && typeof parsed === "object" && "phases" in parsed) {
      return parsed as PlanModel;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

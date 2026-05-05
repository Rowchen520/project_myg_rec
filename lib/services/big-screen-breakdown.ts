import { analyzeWithProvider } from "@/lib/agent/provider";
import type { AgentAnalysis, AgentTaskDraft } from "@/lib/types";

type Difficulty = "low" | "medium" | "high" | "critical";

export interface BigScreenBreakdownTask {
  id: string;
  title: string;
  ownerLabel: string;
  progress: number;
}

export interface BigScreenBreakdownNode {
  id: string;
  phaseId: string;
  label: string;
  title: string;
  date: string;
  difficulty: Difficulty;
  tasks: BigScreenBreakdownTask[];
}

export interface BigScreenBreakdownPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  difficulty: Difficulty;
  summary: string;
}

export interface BigScreenBreakdownPlan {
  phases: BigScreenBreakdownPhase[];
  nodes: BigScreenBreakdownNode[];
  summary: string;
}

interface BreakdownInput {
  documentText: string;
  projectName: string;
  projectStartDate: string;
}

/**
 * Uses the Agent analysis provider to convert a requirement document into screen planning nodes.
 */
export async function breakdownRequirementForBigScreen(input: BreakdownInput): Promise<BigScreenBreakdownPlan> {
  const analysis = await analyzeWithProvider(buildPlanningPrompt(input));
  return analysisToScreenPlan(analysis, input.projectStartDate);
}

function buildPlanningPrompt(input: BreakdownInput) {
  return [
    `项目：${input.projectName}`,
    "请作为项目计划 Agent 阅读需求文档，拆解为功能域、任务项次、关键计划节点和风险难点。",
    "要求：不要按原文逐行机械拆分；请按功能相关性合并、分组，并为每个组生成里程碑节点。",
    "输出应覆盖：阶段目标、关键节点、任务项次、建议负责人角色、难度和计划顺序。",
    "需求文档：",
    input.documentText
  ].join("\n");
}

function analysisToScreenPlan(analysis: AgentAnalysis, projectStartDate: string): BigScreenBreakdownPlan {
  const groups = groupTasksByMilestone(analysis.tasks);
  const start = new Date(projectStartDate);
  const phases: BigScreenBreakdownPhase[] = [];
  const nodes: BigScreenBreakdownNode[] = [];

  groups.forEach(([milestone, tasks], index) => {
    const phaseStart = addDays(start, index * 21);
    const phaseEnd = addDays(phaseStart, 20);
    const phaseId = `ai-phase-${Date.now()}-${index}`;
    const difficulty = inferGroupDifficulty(tasks, analysis, index);

    phases.push({
      id: phaseId,
      name: milestone || `AI 拆解阶段 ${index + 1}`,
      startDate: phaseStart.toISOString(),
      endDate: phaseEnd.toISOString(),
      progress: 0,
      difficulty,
      summary: analysis.nextActions[index] ?? analysis.progressReport ?? "由 AI Agent 生成的阶段计划"
    });

    nodes.push({
      id: `${phaseId}-node`,
      phaseId,
      label: `AI-${index + 1}`,
      title: `${milestone || "关键节点"} 验收`,
      date: phaseEnd.toISOString(),
      difficulty,
      tasks: tasks.map((task, taskIndex) => ({
        id: `${phaseId}-task-${taskIndex}`,
        title: task.title,
        ownerLabel: normalizeRoleLabel(task.assigneeRole),
        progress: 0
      }))
    });
  });

  return {
    phases,
    nodes,
    summary: analysis.productDefinition
  };
}

function groupTasksByMilestone(tasks: AgentTaskDraft[]): Array<[string, AgentTaskDraft[]]> {
  const grouped = new Map<string, AgentTaskDraft[]>();

  for (const task of tasks) {
    const key = task.milestone || inferMilestone(task);
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }

  return Array.from(grouped.entries()).slice(0, 6);
}

function inferMilestone(task: AgentTaskDraft) {
  if (/需求|产品|范围/.test(task.title)) return "需求与范围确认";
  if (/接口|数据|服务|后端/.test(task.title)) return "数据与服务实现";
  if (/界面|看板|大屏|前端/.test(task.title)) return "交互与界面验收";
  if (/测试|部署|发布/.test(task.title)) return "测试与发布准备";
  return "功能闭环验收";
}

function inferGroupDifficulty(tasks: AgentTaskDraft[], analysis: AgentAnalysis, index: number): Difficulty {
  const text = `${tasks.map((task) => `${task.title} ${task.description}`).join(" ")} ${analysis.risks.map((risk) => risk.title).join(" ")}`;
  if (/高风险|严重|瓶颈|攻关|复杂|关键路径/.test(text)) return "critical";
  if (/风险|依赖|集成|AI|算法|架构|性能/.test(text)) return "high";
  if (tasks.some((task) => task.priority === "P0") || index === 0) return "medium";
  return "low";
}

function normalizeRoleLabel(role: string) {
  const lower = role.toLowerCase();
  if (lower.includes("front")) return "前端开发";
  if (lower.includes("back")) return "后端开发";
  if (lower.includes("qa") || lower.includes("ops")) return "测试与部署";
  if (lower.includes("product")) return "产品负责人";
  return role || "待分配";
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

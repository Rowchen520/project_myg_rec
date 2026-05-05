import { prisma } from "@/lib/prisma";
import {
  mapWorkPackage,
  mapWorkPackageApproval,
  mapWorkPackageComment,
  toStoredWorkPackageApprovalStatus,
  toStoredWorkPackageCommentSource,
  toStoredWorkPackageCommentType,
  toStoredDifficulty,
  toStoredWorkPackageOrigin,
  toStoredWorkPackageType,
  type StoredWorkPackage,
  type StoredWorkPackageApproval,
  type StoredWorkPackageComment
} from "@/lib/repositories/workspace-mappers";
import { can } from "@/lib/rbac";
import type {
  Priority,
  Difficulty,
  User,
  WorkPackage,
  WorkPackageApproval,
  WorkPackageApprovalStatus,
  WorkPackageComment,
  WorkPackageCommentSource,
  WorkPackageCommentType,
  WorkPackageOrigin,
  WorkPackageStatus,
  WorkPackageType
} from "@/lib/types";
import { assertPermission, assertProjectVisible, ServiceError } from "./auth-context";

export interface WorkPackageProgressInput {
  percentComplete?: number;
  status?: WorkPackageStatus;
  lastProgressNote?: string;
  assigneeId?: string;
  projectId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateHours?: number | null;
  subject?: string;
  description?: string;
  priority?: Priority;
  difficulty?: Difficulty;
  parentId?: number | null;
}

export interface WorkPackageCreateInput {
  projectId?: string | null;
  type: WorkPackageType;
  subject: string;
  description?: string;
  status?: WorkPackageStatus;
  priority?: Priority;
  difficulty?: Difficulty;
  origin?: WorkPackageOrigin;
  assigneeId?: string;
  parentId?: number;
  startDate?: string;
  dueDate?: string;
  estimateHours?: number;
  requiredSkills?: string[];
  riskLevel?: WorkPackage["riskLevel"];
  riskImpact?: string;
  riskMitigation?: string;
  dependencies?: number[];
  lastProgressNote?: string;
}

export interface WorkPackageCommentInput {
  body: string;
  type?: WorkPackageCommentType;
  mentionsPersonIds?: string[];
  source?: WorkPackageCommentSource;
  sourceChannelId?: string;
  externalMessageId?: string;
  externalThreadId?: string;
  authorDisplayName?: string;
  authorPersonId?: string;
}

export interface WorkPackageApprovalInput {
  status: WorkPackageApprovalStatus;
  comment: string;
  reviewerPersonId?: string;
}

/**
 * Creates a new work package after permission and project scope validation.
 */
export async function createWorkPackage(
  input: WorkPackageCreateInput,
  user: User
): Promise<WorkPackage> {
  const projectId = input.projectId ?? null;
  const isPersonal = projectId === null;

  if (isPersonal) {
    assertPermission(user.role, "createPersonalWorkPackage");
  } else {
    assertPermission(user.role, "assignWorkPackages");
    assertProjectVisible(user, projectId);
  }

  if (!input.subject.trim()) {
    throw new ServiceError("工作项标题不能为空。", 400);
  }

  const created = await prisma.workPackage.create({
    data: {
      projectId,
      type: toStoredWorkPackageType(input.type),
      subject: input.subject.trim(),
      description: input.description ?? "",
      status: input.status ?? defaultStatusForType(input.type),
      priority: input.priority ?? "P1",
      difficulty: toStoredDifficulty(input.difficulty ?? "medium"),
      origin: toStoredWorkPackageOrigin(input.origin ?? (isPersonal ? "self" : "manager")),
      createdByUserId: user.id,
      assigneeId: isPersonal ? input.assigneeId ?? user.personId : input.assigneeId,
      parentId: input.parentId,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      estimateHours: input.estimateHours,
      lastProgressNote: input.lastProgressNote ?? "",
      dependencies: JSON.stringify(input.dependencies ?? []),
      requiredSkills: JSON.stringify(input.requiredSkills ?? []),
      riskLevel: input.riskLevel ? input.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" : null,
      riskImpact: input.riskImpact,
      riskMitigation: input.riskMitigation
    }
  });

  return mapWorkPackage(created as StoredWorkPackage);
}

/**
 * Updates a work package through the server-side permission and project scope
 * boundary.
 */
export async function updateWorkPackage(
  workPackageId: number,
  input: WorkPackageProgressInput,
  user: User
): Promise<WorkPackage> {
  const wp = await loadWorkPackageForUser(workPackageId, user, "updateOwnWorkPackages");
  if (user.role === "participant" && wp.assigneeId !== user.personId) {
    throw new ServiceError("项目参与员只能更新本人工作项。", 403);
  }

  const percentComplete = input.percentComplete === undefined
    ? undefined
    : Math.min(100, Math.max(0, Math.round(input.percentComplete)));
  const status = input.status ?? inferStatusFromPercent(percentComplete, wp.type);
  const nextProjectId = resolveProjectChange(wp, input.projectId, user);
  const updated = await prisma.workPackage.update({
    where: { id: workPackageId },
    data: {
      projectId: nextProjectId,
      percentComplete,
      status,
      lastProgressNote: input.lastProgressNote,
      assigneeId: user.role === "participant" ? undefined : input.assigneeId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      difficulty: input.difficulty ? toStoredDifficulty(input.difficulty) : undefined,
      parentId: input.parentId === undefined ? undefined : input.parentId,
      startDate: input.startDate === undefined ? undefined : input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
      estimateHours: input.estimateHours === undefined ? undefined : input.estimateHours
    }
  });

  return mapWorkPackage(updated as StoredWorkPackage);
}

/**
 * Deletes a work package when the current user is the creator or has the
 * administrator override permission.
 */
export async function deleteWorkPackage(workPackageId: number, user: User): Promise<WorkPackage> {
  const wp = await prisma.workPackage.findUnique({ where: { id: workPackageId } });
  if (!wp) {
    throw new ServiceError("工作项不存在。", 404);
  }

  const mapped = mapWorkPackage(wp as StoredWorkPackage);
  const canDeleteAny = can(user.role, "deleteAnyWorkPackage");
  const isCreator = mapped.createdByUserId === user.id;

  if (!canDeleteAny) {
    assertPermission(user.role, "deleteOwnWorkPackage");
    if (!isCreator) {
      throw new ServiceError("只能删除本人创建的工作项。", 403);
    }
  }

  if (!canDeleteAny && mapped.projectId && !isCreator) {
    assertProjectVisible(user, mapped.projectId);
  }

  await prisma.workPackage.delete({ where: { id: workPackageId } });
  return mapped;
}

/**
 * Persists a work package comment or evidence record after project scope
 * validation.
 */
export async function addWorkPackageComment(
  workPackageId: number,
  input: WorkPackageCommentInput,
  user: User
): Promise<WorkPackageComment> {
  const wp = await loadWorkPackageForUser(workPackageId, user, "updateOwnWorkPackages");
  if (!input.body.trim()) {
    throw new ServiceError("评论内容不能为空。", 400);
  }

  const existing = input.externalMessageId
    ? await prisma.workPackageComment.findFirst({
        where: {
          externalMessageId: input.externalMessageId,
          source: toStoredWorkPackageCommentSource(input.source ?? "generic")
        }
      })
    : null;
  if (existing) {
    return mapWorkPackageComment(existing as StoredWorkPackageComment);
  }

  const comment = await prisma.workPackageComment.create({
    data: {
      workPackageId: wp.id,
      authorPersonId: input.authorPersonId ?? user.personId,
      body: input.body.trim(),
      type: toStoredWorkPackageCommentType(input.type ?? "comment"),
      mentionsPersonIds: JSON.stringify(input.mentionsPersonIds ?? []),
      source: toStoredWorkPackageCommentSource(input.source ?? "platform"),
      sourceChannelId: input.sourceChannelId,
      externalMessageId: input.externalMessageId,
      externalThreadId: input.externalThreadId,
      authorDisplayName: input.authorDisplayName
    }
  });

  return mapWorkPackageComment(comment as StoredWorkPackageComment);
}

/**
 * Persists a project-manager approval decision for a work package.
 */
export async function addWorkPackageApproval(
  workPackageId: number,
  input: WorkPackageApprovalInput,
  user: User
): Promise<WorkPackageApproval> {
  const wp = await loadWorkPackageForUser(workPackageId, user, "approveWorkPackages");
  if (!input.comment.trim()) {
    throw new ServiceError("签核意见不能为空。", 400);
  }

  const approval = await prisma.workPackageApproval.create({
    data: {
      workPackageId: wp.id,
      reviewerPersonId: input.reviewerPersonId ?? user.personId,
      status: toStoredWorkPackageApprovalStatus(input.status),
      comment: input.comment.trim()
    }
  });

  return mapWorkPackageApproval(approval as StoredWorkPackageApproval);
}

async function loadWorkPackageForUser(
  workPackageId: number,
  user: User,
  permissionKey: string
): Promise<WorkPackage> {
  assertPermission(user.role, permissionKey);

  const wp = await prisma.workPackage.findUnique({ where: { id: workPackageId } });
  if (!wp) {
    throw new ServiceError("工作项不存在。", 404);
  }

  const mapped = mapWorkPackage(wp as StoredWorkPackage);
  if (mapped.projectId) {
    assertProjectVisible(user, mapped.projectId);
  } else if (mapped.createdByUserId !== user.id && user.role !== "admin") {
    throw new ServiceError("当前用户无权访问该个人工作项。", 403);
  }
  return mapped;
}

function defaultStatusForType(type: WorkPackageType): WorkPackageStatus {
  switch (type) {
    case "milestone":
      return "planned";
    case "risk":
      return "open";
    case "phase":
      return "planned";
    case "task":
    default:
      return "todo";
  }
}

function resolveProjectChange(
  workPackage: WorkPackage,
  projectId: string | null | undefined,
  user: User
): string | null | undefined {
  if (projectId === undefined) {
    return undefined;
  }

  if (projectId === workPackage.projectId || (!projectId && !workPackage.projectId)) {
    return undefined;
  }

  if (projectId === null) {
    throw new ServiceError("暂不支持把项目工作项改回个人事项。", 400);
  }

  if (workPackage.projectId) {
    throw new ServiceError("只有个人事项可以挂载到项目。", 400);
  }

  if (workPackage.createdByUserId !== user.id && user.role !== "admin") {
    throw new ServiceError("只有创建者或管理员可以挂载个人事项。", 403);
  }

  assertProjectVisible(user, projectId);
  return projectId;
}

function inferStatusFromPercent(
  percentComplete: number | undefined,
  type: WorkPackageType
): WorkPackageStatus | undefined {
  if (percentComplete === undefined) {
    return undefined;
  }

  if (type === "milestone") {
    if (percentComplete >= 100) {
      return "achieved";
    }
    return "planned";
  }

  if (type === "risk") {
    if (percentComplete >= 100) {
      return "closed";
    }
    if (percentComplete > 0) {
      return "mitigating";
    }
    return "open";
  }

  if (percentComplete >= 100) {
    return "done";
  }

  if (percentComplete > 0) {
    return "inProgress";
  }

  return "todo";
}

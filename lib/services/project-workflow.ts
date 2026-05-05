import { prisma } from "@/lib/prisma";
import {
  mapProject,
  serializeEnabledModules,
  toStoredDifficulty,
  toStoredProjectStatus,
  toStoredRiskLevel,
  type StoredProject
} from "@/lib/repositories/workspace-mappers";
import type { Difficulty, Project, ProjectModule, ProjectStatus, RiskLevel, User } from "@/lib/types";
import { assertPermission, assertProjectVisible, ServiceError } from "./auth-context";

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/;

export interface ProjectCreateInput {
  identifier: string;
  name: string;
  description?: string;
  parentId?: string;
  status?: ProjectStatus;
  health?: RiskLevel;
  initialDifficulty?: Difficulty;
  enabledModules: ProjectModule[];
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  status?: ProjectStatus;
  health?: RiskLevel;
  difficultyOverride?: Difficulty | null;
  enabledModules?: ProjectModule[];
}

/**
 * Creates a new project after validating the identifier and the caller's
 * permission. Always seeds the creator as project lead.
 */
export async function createProject(input: ProjectCreateInput, user: User): Promise<Project> {
  assertPermission(user.role, "manageProjects");

  if (!IDENTIFIER_PATTERN.test(input.identifier)) {
    throw new ServiceError(
      "项目标识符必须是小写字母或数字开头，2-41 位，可含 -。",
      400
    );
  }
  if (!input.name.trim()) {
    throw new ServiceError("项目名称不能为空。", 400);
  }
  if (!input.enabledModules.includes("overview")) {
    throw new ServiceError("项目必须至少启用 overview 模块。", 400);
  }
  if (input.parentId) {
    const parent = await prisma.project.findUnique({ where: { id: input.parentId } });
    if (!parent) {
      throw new ServiceError("父项目不存在。", 404);
    }
    if (user.role !== "admin") {
      assertProjectVisible(user, parent.id);
    }
  }

  const project = await prisma.project.create({
    data: {
      identifier: input.identifier,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      parentId: input.parentId ?? null,
      status: toStoredProjectStatus(input.status ?? "active"),
      health: toStoredRiskLevel(input.health ?? "Medium"),
      initialDifficulty: toStoredDifficulty(input.initialDifficulty ?? "medium"),
      progress: 0,
      enabledModules: serializeEnabledModules(input.enabledModules),
      memberships: {
        create: {
          userId: user.id,
          isLead: true
        }
      }
    }
  });

  return mapProject(project as StoredProject);
}

/**
 * Updates an existing project, including module toggles and the project status.
 * Visibility is enforced by `assertProjectVisible`.
 */
export async function updateProject(
  projectId: string,
  input: ProjectUpdateInput,
  user: User
): Promise<Project> {
  assertPermission(user.role, "manageProjects");
  assertProjectVisible(user, projectId);

  if (input.enabledModules && !input.enabledModules.includes("overview")) {
    throw new ServiceError("项目必须至少启用 overview 模块。", 400);
  }

  if (input.difficultyOverride !== undefined && user.role !== "admin") {
    throw new ServiceError("只有管理员可以修改项目难度配置。", 403);
  }

  if (input.parentId) {
    if (input.parentId === projectId) {
      throw new ServiceError("项目不能成为自己的父项目。", 400);
    }
    const parent = await prisma.project.findUnique({ where: { id: input.parentId } });
    if (!parent) {
      throw new ServiceError("父项目不存在。", 404);
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: input.name?.trim(),
      description:
        input.description === undefined
          ? undefined
          : input.description === null
            ? null
            : input.description.trim() || null,
      parentId: input.parentId === undefined ? undefined : input.parentId ?? null,
      status: input.status ? toStoredProjectStatus(input.status) : undefined,
      health: input.health ? toStoredRiskLevel(input.health) : undefined,
      difficultyOverride:
        input.difficultyOverride === undefined
          ? undefined
          : input.difficultyOverride === null
            ? null
            : toStoredDifficulty(input.difficultyOverride),
      enabledModules: input.enabledModules
        ? serializeEnabledModules(input.enabledModules)
        : undefined
    }
  });

  return mapProject(updated as StoredProject);
}

export async function findProjectByIdentifier(identifier: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({ where: { identifier } });
  return project ? mapProject(project as StoredProject) : null;
}

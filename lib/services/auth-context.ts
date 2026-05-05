import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { mapUser, type StoredUser } from "@/lib/repositories/workspace-mappers";
import type { PlatformRole, User } from "@/lib/types";

export interface AuthContext {
  user: User;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

/**
 * Builds a lightweight auth context for the MVP from the `x-user-id` header.
 * Replace this with a real session provider when SSO or account auth is added.
 */
export async function getAuthContextFromRequest(request: Request): Promise<AuthContext> {
  const userId = request.headers.get("x-user-id") ?? "u-pm";
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: true }
  })) as StoredUser | null;

  if (!user) {
    throw new ServiceError("未找到当前用户，请提供有效的 x-user-id。", 401);
  }

  return { user: mapUser(user) };
}

export function assertPermission(role: PlatformRole, permissionKey: string) {
  if (!can(role, permissionKey)) {
    throw new ServiceError("当前角色无权执行该操作。", 403);
  }
}

export function assertProjectVisible(user: User, projectId: string) {
  if (user.role === "admin") {
    return;
  }

  if (![...user.managedProjectIds, ...user.participatingProjectIds].includes(projectId)) {
    throw new ServiceError("当前用户无权访问该项目。", 403);
  }
}

export function toErrorResponse(error: unknown): { body: { error: string }; status: number } {
  if (error instanceof ServiceError) {
    return { body: { error: error.message }, status: error.status };
  }

  return {
    body: { error: error instanceof Error ? error.message : "服务端处理失败。" },
    status: 500
  };
}

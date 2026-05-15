import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { mapUser, type StoredUser } from "@/lib/repositories/workspace-mappers";
import type { PlatformRole, User } from "@/lib/types";
import { SESSION_COOKIE_NAME } from "./session-cookie";

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
 * Resolves a platform user by either internal user id or Feishu open_id.
 * open_id is the canonical external identity; user id remains the internal relation key.
 */
export async function resolveStoredUserByIdentity(identity: string): Promise<StoredUser | null> {
  return (await prisma.user.findFirst({
    where: {
      OR: [
        { id: identity },
        { feishuBinding: { is: { openId: identity, revokedAt: null } } }
      ]
    },
    include: {
      memberships: true,
      feishuBinding: {
        select: {
          openId: true,
          revokedAt: true
        }
      }
    }
  })) as StoredUser | null;
}

/**
 * Builds a lightweight auth context for the MVP from the active session cookie,
 * preferring open_id as external identity and falling back to legacy `x-user-id`.
 */
export async function getAuthContextFromRequest(request: Request): Promise<AuthContext> {
  const cookieStore = await cookies();
  const identity =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ??
    request.headers.get("x-open-id") ??
    request.headers.get("x-user-id");

  if (!identity) {
    throw new ServiceError("当前请求未登录。", 401);
  }

  const user = await resolveStoredUserByIdentity(identity);

  if (!user) {
    throw new ServiceError("未找到当前用户，请提供有效的 open_id 或 userId。", 401);
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

import { cache } from "react";
import { getCurrentUserFromSession } from "@/lib/services/auth-server";
import { loadWorkspaceSnapshot, type WorkspaceSnapshotResult } from "@/lib/services/workspace";
import type { User } from "@/lib/types";

export interface ShellRequestContext extends WorkspaceSnapshotResult {
  currentUser: User | undefined;
}

/**
 * 单次请求内去重：全局布局与页面常重复拉取同一份快照与会话。
 * 使用 React `cache()` 合并为一次 Prisma/回退逻辑，减轻 SQLite 并发与 RSC 耗时。
 */
export const getShellRequestContext = cache(async (): Promise<ShellRequestContext> => {
  const currentUser = await getCurrentUserFromSession();
  const workspace = await loadWorkspaceSnapshot({ userId: currentUser?.id });
  return { ...workspace, currentUser };
});

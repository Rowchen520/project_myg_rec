import { getWorkspaceSnapshotFromRepository, type WorkspaceRepositoryOptions } from "@/lib/repositories/workspace-repository";
import { sampleWorkspace } from "@/lib/sample-data";
import type { WorkspaceSnapshot } from "@/lib/types";

export interface WorkspaceSnapshotResult {
  snapshot: WorkspaceSnapshot;
  source: "database" | "sample";
  warning?: string;
}

/**
 * Loads the workspace from the production repository and falls back to sample
 * data only when the local database is unavailable or not seeded.
 */
export async function loadWorkspaceSnapshot(
  options: WorkspaceRepositoryOptions = {}
): Promise<WorkspaceSnapshotResult> {
  try {
    const snapshot = await getWorkspaceSnapshotFromRepository(options);
    if (snapshot.projects.length === 0 || snapshot.workPackages.length === 0) {
      return {
        snapshot: sampleWorkspace,
        source: "sample",
        warning: "数据库暂无项目或任务数据，已回退到演示快照。"
      };
    }

    return { snapshot, source: "database" };
  } catch (error) {
    return {
      snapshot: sampleWorkspace,
      source: "sample",
      warning: error instanceof Error ? error.message : "数据库快照读取失败。"
    };
  }
}

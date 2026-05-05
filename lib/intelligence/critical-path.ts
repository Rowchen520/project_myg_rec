import type { WorkPackage } from "@/lib/types";

/**
 * Computes a critical path using dependencies and due dates. Falls back to P0
 * items when dependency data is sparse.
 */
export function calculateCriticalPathIds(workPackages: WorkPackage[]): Set<number> {
  const projectItems = workPackages.filter((wp) => wp.projectId);
  const itemById = new Map(projectItems.map((wp) => [wp.id, wp]));
  const memo = new Map<number, { score: number; path: number[] }>();

  function score(id: number): { score: number; path: number[] } {
    const cached = memo.get(id);
    if (cached) return cached;

    const item = itemById.get(id);
    if (!item) {
      return { score: 0, path: [] };
    }

    const dependencyScores = item.dependencies
      .filter((dependencyId) => itemById.has(dependencyId))
      .map(score);
    const bestDependency = dependencyScores.sort((left, right) => right.score - left.score)[0];
    const duration = estimateDurationDays(item);
    const result = bestDependency
      ? { score: bestDependency.score + duration, path: [...bestDependency.path, id] }
      : { score: duration, path: [id] };

    memo.set(id, result);
    return result;
  }

  const dependencyBased = projectItems
    .filter((wp) => wp.dependencies.length > 0)
    .map((wp) => score(wp.id))
    .sort((left, right) => right.score - left.score)[0];

  if (dependencyBased?.path.length) {
    return new Set(dependencyBased.path);
  }

  return new Set(
    projectItems
      .filter((wp) => wp.priority === "P0")
      .sort((left, right) => {
        const leftDate = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDate = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      })
      .map((wp) => wp.id)
  );
}

function estimateDurationDays(workPackage: WorkPackage): number {
  if (workPackage.startDate && workPackage.dueDate) {
    const start = new Date(workPackage.startDate).getTime();
    const end = new Date(workPackage.dueDate).getTime();
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    }
  }

  return Math.max(1, Math.ceil((workPackage.estimateHours ?? 8) / 8));
}

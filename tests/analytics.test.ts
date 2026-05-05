import { describe, expect, it } from "vitest";
import { calculateDashboardStats, groupWorkPackages } from "@/lib/analytics";
import { sampleWorkspace } from "@/lib/sample-data";

describe("dashboard analytics", () => {
  it("calculates project progress, blockers, and workload from work packages", () => {
    const stats = calculateDashboardStats(sampleWorkspace);

    expect(stats.projectCount).toBe(sampleWorkspace.projects.length);
    expect(stats.workPackageCount).toBe(sampleWorkspace.workPackages.length);
    expect(stats.blockedCount).toBeGreaterThan(0);
    expect(stats.workloadByPerson).toHaveLength(sampleWorkspace.people.length);
  });

  it("groups work packages dynamically by status and type", () => {
    const byStatus = groupWorkPackages(sampleWorkspace.workPackages, "status");
    const byType = groupWorkPackages(sampleWorkspace.workPackages, "type");

    expect(Object.keys(byStatus)).toContain("blocked");
    expect(byType.task?.length).toBeGreaterThan(0);
    expect(byType.risk?.length).toBeGreaterThan(0);
  });
});

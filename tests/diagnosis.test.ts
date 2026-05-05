import { describe, expect, it } from "vitest";
import { buildProjectDiagnosis } from "@/lib/intelligence/diagnosis";
import { sampleWorkspace } from "@/lib/sample-data";

describe("project diagnosis", () => {
  it("returns at most three actions and explains the overall summary", () => {
    const diagnosis = buildProjectDiagnosis(sampleWorkspace, {
      now: new Date("2026-04-28T12:00:00.000Z")
    });

    expect(diagnosis.actions.length).toBeGreaterThan(0);
    expect(diagnosis.actions.length).toBeLessThanOrEqual(3);
    expect(diagnosis.summary).toContain("健康度");
    expect(diagnosis.contributors.length).toBeGreaterThan(0);
  });

  it("prioritizes blocked work packages as the first high level action", () => {
    const diagnosis = buildProjectDiagnosis(sampleWorkspace, {
      now: new Date("2026-04-28T12:00:00.000Z")
    });

    const firstAction = diagnosis.actions[0];
    expect(firstAction.level).toBe("High");
    expect(firstAction.title).toContain("解锁阻塞");
    expect(firstAction.workPackageId).toBeGreaterThan(0);
  });

  it("falls back to a steady-state action when no urgent issue exists", () => {
    const calmWorkspace = {
      ...sampleWorkspace,
      workPackages: sampleWorkspace.workPackages
        .filter((wp) => wp.type !== "risk")
        .map((wp) => ({
          ...wp,
          status: "done" as const,
          percentComplete: 100,
          lastUpdatedAt: "2026-04-28T00:00:00.000Z",
          dueDate: "2026-05-30T00:00:00.000Z"
        }))
    };

    const diagnosis = buildProjectDiagnosis(calmWorkspace, {
      now: new Date("2026-04-28T12:00:00.000Z")
    });

    expect(diagnosis.actions[0].title).toContain("保持当前节奏");
    expect(diagnosis.overallLevel).toBe("Low");
  });
});

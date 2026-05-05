import { describe, expect, it } from "vitest";
import { buildBigScreenViewModel } from "@/lib/services/big-screen";
import { sampleWorkspace } from "@/lib/sample-data";

describe("big screen view model", () => {
  it("builds phases, tasks, milestones, and critical path ids", () => {
    const view = buildBigScreenViewModel(
      sampleWorkspace,
      "proj-ai-pm",
      sampleWorkspace.users.find((user) => user.role === "admin"),
      new Date("2026-04-29T00:00:00.000Z")
    );

    expect(view.meta.projectName).toBe("AI 项目管理平台");
    expect(view.timeline.quarters).toHaveLength(4);
    expect(view.phases.length).toBeGreaterThan(0);
    expect(view.phases[0].tasks.length).toBeGreaterThan(0);
    expect(view.criticalPathIds.length).toBeGreaterThan(0);
  });
});

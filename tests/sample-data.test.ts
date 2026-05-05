import { describe, expect, it } from "vitest";
import { sampleWorkspace } from "@/lib/sample-data";

describe("sample workspace", () => {
  it("includes the OpenProject-style parent/sub project hierarchy", () => {
    const root = sampleWorkspace.projects.find((project) => !project.parentId);
    const child = sampleWorkspace.projects.find((project) => project.parentId === root?.id);
    const grandchild = sampleWorkspace.projects.find((project) => project.parentId === child?.id);

    expect(root).toBeDefined();
    expect(child).toBeDefined();
    expect(grandchild).toBeDefined();
  });

  it("encodes per-project enabled modules", () => {
    const ai = sampleWorkspace.projects.find((project) => project.identifier === "ai-pm");
    const platform = sampleWorkspace.projects.find((project) => project.identifier === "platform");

    expect(ai?.enabledModules).toContain("work_packages");
    expect(ai?.enabledModules).toContain("ai_diagnosis");
    expect(platform?.enabledModules).not.toContain("work_packages");
  });

  it("uses unified WorkPackage rows with type-specific metadata", () => {
    const risk = sampleWorkspace.workPackages.find((wp) => wp.type === "risk");
    expect(risk).toBeDefined();
    expect(risk?.riskLevel).toBeDefined();
    expect(risk?.riskMitigation).toBeTruthy();

    const milestone = sampleWorkspace.workPackages.find((wp) => wp.type === "milestone");
    expect(milestone).toBeDefined();

    const task = sampleWorkspace.workPackages.find((wp) => wp.type === "task");
    expect(task).toBeDefined();
    expect(typeof task?.id).toBe("number");
  });
});

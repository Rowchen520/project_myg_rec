import { describe, expect, it } from "vitest";
import { updateProject } from "@/lib/services/project-workflow";
import type { User } from "@/lib/types";

describe("project difficulty permissions", () => {
  it("rejects project difficulty changes from non-admin users after creation", async () => {
    const user: User = {
      id: "u-pm",
      name: "项目经理",
      role: "projectManager",
      personId: "p1",
      managedProjectIds: ["proj-ai-pm"],
      participatingProjectIds: ["proj-ai-pm"]
    };

    await expect(updateProject("proj-ai-pm", { difficultyOverride: "high" }, user))
      .rejects
      .toThrow("只有管理员可以修改项目难度配置。");
  });
});

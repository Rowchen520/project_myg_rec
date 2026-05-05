import { describe, expect, it } from "vitest";
import { runMockAgentWorkflow, splitDemand } from "@/lib/agent/orchestrator";

describe("agent orchestrator", () => {
  it("splits natural language demand into task segments", () => {
    expect(splitDemand("实现看板，添加部署，生成风险报告")).toEqual([
      "实现看板",
      "添加部署",
      "生成风险报告"
    ]);
  });

  it("creates tasks and risks for unattended deployment work", () => {
    const analysis = runMockAgentWorkflow("实现无人值守开发，添加测试和部署到服务器");

    expect(analysis.tasks.length).toBeGreaterThan(0);
    expect(analysis.tasks.some((task) => task.priority === "P0")).toBe(true);
    expect(analysis.risks.some((risk) => risk.level === "Medium")).toBe(true);
    expect(analysis.progressReport).toContain("已拆解");
  });
});

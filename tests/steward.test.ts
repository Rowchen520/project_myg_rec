import { describe, expect, it } from "vitest";
import { buildStewardReport, generateStewardMessages } from "@/lib/steward";
import { sampleWorkspace } from "@/lib/sample-data";

describe("steward", () => {
  it("builds a progress and risk report from work packages", () => {
    const report = buildStewardReport(sampleWorkspace);

    expect(report.summary).toContain("当前平均进度");
    expect(["Low", "Medium", "High"]).toContain(report.riskLevel);
    expect(report.nextActions.length).toBeGreaterThan(0);
  });

  it("generates dashboard messages", () => {
    const messages = generateStewardMessages(sampleWorkspace);

    expect(messages).toHaveLength(2);
    expect(messages[0].title).toContain("AI 管家");
  });
});

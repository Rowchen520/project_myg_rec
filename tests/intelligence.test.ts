import { describe, expect, it } from "vitest";
import { calculateProjectHealthScores } from "@/lib/intelligence/health";
import { calculateCriticalPathIds } from "@/lib/intelligence/critical-path";
import { buildReminderItems } from "@/lib/intelligence/reminders";
import { buildSchedulingSuggestions } from "@/lib/intelligence/scheduling";
import { sampleWorkspace } from "@/lib/sample-data";

describe("project intelligence", () => {
  it("calculates a 0-100 health score with traceable contributors", () => {
    const scores = calculateProjectHealthScores(sampleWorkspace);

    expect(scores).toHaveLength(sampleWorkspace.projects.length);
    const aiPmScore = scores.find((score) => score.projectId === "proj-ai-pm");
    expect(aiPmScore).toBeDefined();
    expect(aiPmScore!.score).toBeGreaterThanOrEqual(0);
    expect(aiPmScore!.score).toBeLessThanOrEqual(100);
    expect(aiPmScore!.contributors.some((item) => item.label.includes("阻塞"))).toBe(true);
    expect(aiPmScore!.contributors.some((item) => item.label.includes("完成率"))).toBe(true);
    expect(["Low", "Medium", "High"]).toContain(aiPmScore!.level);
  });

  it("ranks scheduling suggestions by urgency and exposes reasoning", () => {
    const suggestions = buildSchedulingSuggestions(sampleWorkspace);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].urgency).toBeGreaterThanOrEqual(suggestions[suggestions.length - 1].urgency);
    expect(suggestions[0].reason).toContain("优先级");
    expect(suggestions[0].suggestedPersonId).toMatch(/^p\d+/);
  });

  it("builds reminders with channel routing for stalled and blocked work packages", () => {
    const reminders = buildReminderItems(sampleWorkspace, { now: new Date("2026-04-28T12:00:00.000Z") });

    expect(reminders.length).toBeGreaterThan(0);
    const blockedReminder = reminders.find((reminder) => reminder.workPackageId === 4);
    expect(blockedReminder).toBeDefined();
    expect(blockedReminder?.level).toBe("High");
    expect(blockedReminder?.message).toContain("阻塞");
    expect(blockedReminder?.preferredChannelIds.length).toBeGreaterThan(0);
  });

  it("calculates critical path from dependency chains", () => {
    const ids = calculateCriticalPathIds(sampleWorkspace.workPackages);

    expect(sampleWorkspace.workPackages.some((wp) => ids.has(wp.id) && wp.priority === "P0")).toBe(true);
    expect(ids.size).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { isFlagEnabledForUser, type PlatformFeatureFlagDto } from "@/lib/services/feature-flags";
import { buildPlatformOverviewSnapshot } from "@/lib/services/platform-overview";
import { sampleWorkspace } from "@/lib/sample-data";

describe("platform overview", () => {
  it("aggregates project metrics without counting personal work packages", () => {
    const admin = sampleWorkspace.users.find((user) => user.role === "admin");
    const overview = buildPlatformOverviewSnapshot(sampleWorkspace, admin, new Date("2026-04-29T00:00:00.000Z"));

    expect(overview.global.projectCount).toBe(sampleWorkspace.projects.length);
    expect(overview.global.workPackageCount).toBe(
      sampleWorkspace.workPackages.filter((wp) => wp.projectId).length
    );
    expect(overview.projects.some((project) => project.projectIdentifier === "ai-pm")).toBe(true);
  });

  it("filters participant overview to participating projects", () => {
    const participant = sampleWorkspace.users.find((user) => user.role === "participant")!;
    const overview = buildPlatformOverviewSnapshot(sampleWorkspace, participant, new Date("2026-04-29T00:00:00.000Z"));

    expect(overview.projects.every((project) => participant.participatingProjectIds.includes(project.projectId))).toBe(true);
  });

  it("evaluates role-level feature flag overrides", () => {
    const flags: PlatformFeatureFlagDto[] = [
      {
        key: "platformOverview",
        siteEnabled: true,
        description: "平台总览",
        roleOverrides: { participant: false }
      }
    ];
    const participant = sampleWorkspace.users.find((user) => user.role === "participant")!;

    expect(isFlagEnabledForUser(flags, "platformOverview", participant)).toBe(false);
    expect(isFlagEnabledForUser(flags, "platformOverview", sampleWorkspace.users[0])).toBe(true);
  });
});

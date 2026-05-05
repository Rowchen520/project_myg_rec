import { describe, expect, it } from "vitest";
import {
  buildWorkPackageCollaborationInsight,
  buildWorkPackageCollaborationInsights,
  createWorkPackageApproval,
  createWorkPackageComment,
  importExternalWorkPackageComment
} from "@/lib/collaboration";
import { sampleWorkspace } from "@/lib/sample-data";

describe("work package collaboration", () => {
  it("summarizes comments, decisions, blockers, and approvals", () => {
    const insights = buildWorkPackageCollaborationInsights(sampleWorkspace);
    const releaseInsight = insights.find((insight) => insight.workPackageId === 4);

    expect(releaseInsight).toBeDefined();
    expect(releaseInsight?.status).toBe("changesRequested");
    expect(releaseInsight?.blockerCount).toBeGreaterThan(0);
    expect(releaseInsight?.aiSummary).toContain("Docker");
    expect(releaseInsight?.nextAction).toContain("补充证据");
  });

  it("marks review work packages with no approval as pending", () => {
    const wp = sampleWorkspace.workPackages.find((item) => item.id === 3);
    expect(wp).toBeDefined();

    const insight = buildWorkPackageCollaborationInsight(wp!, [], []);

    expect(insight.status).toBe("pending");
    expect(insight.nextAction).toContain("签核");
  });

  it("creates deterministic approval and evidence records", () => {
    const now = new Date("2026-04-29T00:00:00.000Z");
    const approval = createWorkPackageApproval(3, "p1", "approved", "通过", now);
    const comment = createWorkPackageComment(3, "p2", "补充测试证据", "evidence", ["p1"], now);

    expect(approval.id).toContain("approval-3-p1");
    expect(approval.status).toBe("approved");
    expect(comment.id).toContain("comment-3-p2");
    expect(comment.mentionsPersonIds).toEqual(["p1"]);
  });

  it("imports external IM messages into work package comments", () => {
    const result = importExternalWorkPackageComment(
      {
        source: "feishu",
        text: "#3 已补充截图证据，请 @产品负责人 复核",
        externalMessageId: "om-test-001",
        senderName: "前端开发",
        sourceChannelId: "ch-feishu-core"
      },
      sampleWorkspace,
      new Date("2026-04-29T00:05:00.000Z")
    );

    expect(result.status).toBe("imported");
    expect(result.comment?.workPackageId).toBe(3);
    expect(result.comment?.type).toBe("evidence");
    expect(result.comment?.source).toBe("feishu");
    expect(result.comment?.mentionsPersonIds).toContain("p1");
  });

  it("skips duplicated external messages by external message id", () => {
    const result = importExternalWorkPackageComment(
      {
        source: "feishu",
        text: "#3 重复消息",
        externalMessageId: "om_demo_wp3_001",
        senderName: "前端开发"
      },
      sampleWorkspace
    );

    expect(result.status).toBe("duplicate");
  });

  it("returns unmatched when no work package can be inferred", () => {
    const result = importExternalWorkPackageComment(
      {
        source: "slack",
        text: "这是一条没有工作项上下文的消息",
        externalMessageId: "slack-test-001",
        senderName: "未知用户"
      },
      sampleWorkspace
    );

    expect(result.status).toBe("unmatched");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildDingtalkPayload,
  buildEmailPayload,
  buildFeishuPayload,
  buildGenericPayload,
  buildPayloadForChannel,
  buildSlackPayload,
  buildWecomPayload,
  getChannelTypeLabel
} from "@/lib/notifications/channels";
import {
  buildDeliveries,
  markDeliveriesAsSent,
  ruleMatches,
  toUnifiedNotification
} from "@/lib/notifications/router";
import { sampleWorkspace } from "@/lib/sample-data";
import type { StewardMessage, UnifiedNotification } from "@/lib/types";

const stewardMessage: StewardMessage = {
  id: "m-test",
  type: "risk",
  title: "部署风险升级",
  body: "VPS 凭据缺失导致部署阻塞，需要立即处理。",
  level: "Medium",
  createdAt: "2026-04-28T12:00:00.000Z"
};

const baseNotification: UnifiedNotification = {
  id: "notif-test",
  title: "部署风险升级",
  body: "VPS 凭据缺失导致部署阻塞，需要立即处理。",
  level: "High",
  eventType: "risk",
  highlights: ["项目：AI 项目管理平台", "影响：阻塞部署"]
};

describe("notification channel adapters", () => {
  it("builds a Feishu interactive card with header color and link button", () => {
    const payload = buildFeishuPayload({ ...baseNotification, link: "https://example.com" });

    expect(payload.msg_type).toBe("interactive");
    expect((payload.card as { header: { template: string } }).header.template).toBe("red");
    const elements = (payload.card as { elements: Array<{ tag: string }> }).elements;
    expect(elements.some((element) => element.tag === "action")).toBe(true);
  });

  it("falls back to blue header for Low level Feishu cards", () => {
    const payload = buildFeishuPayload({ ...baseNotification, level: "Low" });

    expect((payload.card as { header: { template: string } }).header.template).toBe("blue");
  });

  it("builds WeChat Work, DingTalk, Slack, email and generic payloads", () => {
    expect((buildWecomPayload(baseNotification) as { msgtype: string }).msgtype).toBe("markdown");
    expect((buildDingtalkPayload(baseNotification) as { msgtype: string }).msgtype).toBe("markdown");
    expect((buildSlackPayload(baseNotification) as { blocks: unknown[] }).blocks.length).toBeGreaterThan(1);
    expect((buildEmailPayload(baseNotification) as { subject: string }).subject).toContain("部署风险升级");
    expect((buildGenericPayload(baseNotification) as { eventType: string }).eventType).toBe("risk");
  });

  it("dispatches via buildPayloadForChannel based on channel type", () => {
    expect((buildPayloadForChannel("feishu", baseNotification) as { msg_type: string }).msg_type).toBe(
      "interactive"
    );
    expect(getChannelTypeLabel("dingtalk")).toBe("钉钉");
  });
});

describe("notification router", () => {
  it("converts steward messages into unified notifications", () => {
    const notification = toUnifiedNotification(stewardMessage);

    expect(notification.eventType).toBe("risk");
    expect(notification.highlights).toContain("事件类型：风险预警");
  });

  it("matches rules by event type and minimum level", () => {
    const rule = sampleWorkspace.notificationRules.find((item) => item.id === "rule-risk-broadcast");
    const lowProgressRule = sampleWorkspace.notificationRules.find((item) => item.id === "rule-progress-feishu");
    const lowLevelMessage = toUnifiedNotification({ ...stewardMessage, level: "Low" });

    expect(rule).toBeDefined();
    expect(ruleMatches(rule!, toUnifiedNotification(stewardMessage))).toBe(true);
    expect(ruleMatches(rule!, lowLevelMessage)).toBe(false);
    expect(ruleMatches(lowProgressRule!, toUnifiedNotification({ ...stewardMessage, type: "planning", level: "Low" }))).toBe(true);
  });

  it("builds deliveries scoped by viewer role", () => {
    const deliveries = buildDeliveries(
      [stewardMessage],
      sampleWorkspace.notificationChannels,
      sampleWorkspace.notificationRules,
      { viewerRole: "projectManager", now: "2026-04-28T12:00:00.000Z" }
    );

    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries.every((delivery) => delivery.audienceRoles.includes("projectManager"))).toBe(true);
    expect(deliveries.every((delivery) => delivery.status === "preview")).toBe(true);
  });

  it("excludes participants from rules they cannot see", () => {
    const deliveries = buildDeliveries(
      [stewardMessage],
      sampleWorkspace.notificationChannels,
      sampleWorkspace.notificationRules,
      { viewerRole: "participant" }
    );

    expect(deliveries.length).toBe(0);
  });

  it("marks deliveries as sent without mutating their payloads", () => {
    const deliveries = buildDeliveries(
      [stewardMessage],
      sampleWorkspace.notificationChannels,
      sampleWorkspace.notificationRules,
      { viewerRole: "admin" }
    );
    const sent = markDeliveriesAsSent(deliveries);

    expect(sent.every((delivery) => delivery.status === "sent")).toBe(true);
    expect(sent[0].payload).toEqual(deliveries[0].payload);
  });
});

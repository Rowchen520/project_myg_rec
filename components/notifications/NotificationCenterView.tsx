"use client";

import { useState } from "react";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { getChannelTypeLabel } from "@/lib/notifications/channels";
import { buildDeliveries, markDeliveriesAsSent } from "@/lib/notifications/router";
import { riskLevelTone } from "@/lib/work-package-presentation";
import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationRule,
  StewardMessage,
  User
} from "@/lib/types";

interface NotificationCenterViewProps {
  channels: NotificationChannel[];
  rules: NotificationRule[];
  stewardMessages: StewardMessage[];
  currentUser?: User;
  canManage: boolean;
}

/**
 * Notification center: lists steward-driven deliveries, the routing rules,
 * and the available channels. The audit pane is the focus, with channel
 * and rule context surfaced in compact cards above.
 */
export function NotificationCenterView({
  channels,
  rules,
  stewardMessages,
  currentUser,
  canManage
}: NotificationCenterViewProps) {
  const [localChannels, setLocalChannels] = useState(channels);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>(() =>
    buildDeliveries(stewardMessages, channels, rules, {
      viewerRole: currentUser?.role
    })
  );
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);

  function toggleChannel(channelId: string) {
    if (!canManage) return;
    setLocalChannels((current) => {
      const next = current.map((channel) =>
        channel.id === channelId ? { ...channel, enabled: !channel.enabled } : channel
      );
      setDeliveries(
        buildDeliveries(stewardMessages, next, rules, {
          viewerRole: currentUser?.role
        })
      );
      return next;
    });
  }

  function simulateSend(delivery: NotificationDelivery) {
    setDeliveries((current) => [
      ...markDeliveriesAsSent([delivery]),
      ...current.filter((item) => item.id !== delivery.id)
    ]);
  }

  function simulateSendAll() {
    setDeliveries((current) => markDeliveriesAsSent(current));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16
        }}
      >
        <Surface
          title="通讯通道"
          description={canManage ? "可启用或停用通道。" : "仅管理员可调整。"}
          flush
        >
          {localChannels.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState title="当前用户没有可见的通道" />
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 4 }}>
              {localChannels.map((channel) => (
                <li
                  key={channel.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "var(--bg-subtle)",
                    overflow: "hidden"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13 }}>{channel.name}</strong>
                    <p
                      className="hint mono"
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {getChannelTypeLabel(channel.type)} · {channel.target.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={channel.enabled ? "success" : "default"}
                    disabled={!canManage}
                    onClick={() => toggleChannel(channel.id)}
                    style={{ flexShrink: 0 }}
                  >
                    {channel.enabled ? "已启用" : "未启用"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface
          title="路由规则"
          description="事件类型 + 最小风险等级决定推送通道。"
          flush
        >
          {rules.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState title="无可见规则" />
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 4 }}>
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: "var(--bg-subtle)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: 13 }}>{rule.name}</strong>
                    <Badge tone={riskLevelTone(rule.minLevel)}>≥ {rule.minLevel}</Badge>
                  </div>
                  <p className="hint" style={{ margin: "6px 0 2px", fontSize: 11 }}>
                    事件 {rule.eventTypes.join(" · ")}
                  </p>
                  <p className="hint" style={{ margin: 0, fontSize: 11 }}>
                    通道 {rule.channelIds
                      .map((id) => localChannels.find((channel) => channel.id === id)?.name)
                      .filter(Boolean)
                      .join(" / ") || "无可见通道"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      <Surface
        title={`投递审计 (${deliveries.length})`}
        description="按 AI 管家与项目事件模拟向通道的投递负载。"
        actions={
          deliveries.length > 0 ? (
            <Button size="sm" variant="primary" onClick={simulateSendAll} disabled={!canManage}>
              一键模拟投递
            </Button>
          ) : null
        }
        flush
      >
        {deliveries.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title="暂无可投递的消息"
              description="可先运行 AI 诊断或在工作项触发风险后再来查看。"
            />
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {deliveries.map((delivery, index) => (
              <li
                key={delivery.id}
                style={{
                  padding: "12px 16px",
                  borderTop: index === 0 ? undefined : "1px solid var(--border-muted)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge
                        tone={
                          delivery.status === "sent"
                            ? "success"
                            : delivery.status === "failed"
                              ? "danger"
                              : "default"
                        }
                      >
                        {deliveryStatusLabel(delivery.status)}
                      </Badge>
                      <strong style={{ fontSize: 13 }}>{delivery.notification.title}</strong>
                    </div>
                    <p className="hint" style={{ margin: "4px 0 0", fontSize: 12 }}>
                      {delivery.preview}
                    </p>
                    <p className="hint" style={{ margin: "4px 0 0", fontSize: 11 }}>
                      通道 {delivery.channelName} · 规则 {delivery.ruleName}
                    </p>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!canManage || delivery.status === "sent"}
                      onClick={() => simulateSend(delivery)}
                    >
                      模拟发送
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedDeliveryId((current) => (current === delivery.id ? null : delivery.id))
                      }
                    >
                      {expandedDeliveryId === delivery.id ? "收起" : "查看负载"}
                    </Button>
                  </div>
                </div>
                {expandedDeliveryId === delivery.id ? (
                  <pre
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: "var(--bg-muted)",
                      borderRadius: 6,
                      fontSize: 11,
                      maxHeight: 240,
                      overflow: "auto",
                      lineHeight: 1.6,
                      fontFamily: "var(--font-mono)"
                    }}
                  >
                    {JSON.stringify(delivery.payload, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}

function deliveryStatusLabel(status: NotificationDelivery["status"]) {
  if (status === "sent") return "已发送";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  return "预览";
}

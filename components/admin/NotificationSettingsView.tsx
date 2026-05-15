import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { getChannelTypeLabel } from "@/lib/notifications/channels";
import { riskLevelTone } from "@/lib/work-package-presentation";
import type { NotificationChannel, NotificationRule } from "@/lib/types";

interface NotificationSettingsViewProps {
  channels: NotificationChannel[];
  rules: NotificationRule[];
}

export function NotificationSettingsView({ channels, rules }: NotificationSettingsViewProps) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface title={`通讯通道 (${channels.length})`} description="管理员统一查看当前可用通知通道。" flush>
        {channels.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState title="暂无通讯通道" />
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 6 }}>
            {channels.map((channel) => (
              <li key={channel.id} className="muted-card" style={{ padding: 12, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{channel.name}</strong>
                  <Badge tone={channel.enabled ? "success" : "default"}>{channel.enabled ? "已启用" : "未启用"}</Badge>
                </div>
                <p className="hint mono" style={{ margin: 0, fontSize: 11 }}>
                  {getChannelTypeLabel(channel.type)} · {channel.target}
                </p>
                <p className="hint" style={{ margin: 0, fontSize: 11 }}>
                  面向角色：{channel.audienceRoles.length ? channel.audienceRoles.join(" / ") : "未限制"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface title={`路由规则 (${rules.length})`} description="管理员统一查看事件与通道映射规则。" flush>
        {rules.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState title="暂无路由规则" />
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 6 }}>
            {rules.map((rule) => (
              <li key={rule.id} className="muted-card" style={{ padding: 12, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{rule.name}</strong>
                  <Badge tone={riskLevelTone(rule.minLevel)}>≥ {rule.minLevel}</Badge>
                </div>
                <p className="hint" style={{ margin: 0, fontSize: 11 }}>
                  事件：{rule.eventTypes.join(" / ")}
                </p>
                <p className="hint" style={{ margin: 0, fontSize: 11 }}>
                  通道：{rule.channelIds
                    .map((id) => channels.find((channel) => channel.id === id)?.name)
                    .filter(Boolean)
                    .join(" / ") || "无可见通道"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
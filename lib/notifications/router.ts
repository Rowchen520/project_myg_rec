import {
  buildPayloadForChannel,
  buildPreviewText,
  getChannelTypeLabel
} from "./channels";
import type {
  NotificationChannel,
  NotificationDelivery,
  NotificationLevel,
  NotificationRule,
  PlatformRole,
  StewardMessage,
  UnifiedNotification
} from "../types";

const levelWeight: Record<NotificationLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3
};

const eventLabels: Record<UnifiedNotification["eventType"], string> = {
  progress: "项目进展",
  risk: "风险预警",
  deployment: "部署告警",
  planning: "项目计划"
};

/**
 * Converts a steward message into the unified notification model.
 */
export function toUnifiedNotification(message: StewardMessage): UnifiedNotification {
  return {
    id: `notif-${message.id}`,
    title: message.title,
    body: message.body,
    level: message.level,
    eventType: message.type,
    highlights: [
      `事件类型：${eventLabels[message.type]}`,
      `创建时间：${formatDateTime(message.createdAt)}`
    ]
  };
}

/**
 * Decides whether a notification rule matches a notification.
 */
export function ruleMatches(rule: NotificationRule, notification: UnifiedNotification): boolean {
  if (!rule.eventTypes.includes(notification.eventType)) {
    return false;
  }

  return levelWeight[notification.level] >= levelWeight[rule.minLevel];
}

interface BuildDeliveriesOptions {
  /** Restrict deliveries to channels and rules visible to this role. */
  viewerRole?: PlatformRole;
  /** Optional ISO timestamp used for deterministic delivery ids. */
  now?: string;
  /** Optional override for delivery status. */
  status?: NotificationDelivery["status"];
}

/**
 * Builds notification deliveries for a list of steward messages using the
 * configured channels and rules. Channels disabled or unmatched are skipped.
 */
export function buildDeliveries(
  messages: StewardMessage[],
  channels: NotificationChannel[],
  rules: NotificationRule[],
  options: BuildDeliveriesOptions = {}
): NotificationDelivery[] {
  const channelLookup = new Map(channels.map((channel) => [channel.id, channel]));
  const now = options.now ?? new Date().toISOString();
  const status = options.status ?? "preview";
  const viewerRole = options.viewerRole;

  return messages.flatMap((message) => {
    const notification = toUnifiedNotification(message);

    return rules
      .filter((rule) => ruleMatches(rule, notification))
      .filter((rule) => (viewerRole ? rule.audienceRoles.includes(viewerRole) : true))
      .flatMap((rule) =>
        rule.channelIds
          .map((channelId) => channelLookup.get(channelId))
          .filter((channel): channel is NotificationChannel => Boolean(channel))
          .filter((channel) => channel.enabled)
          .filter((channel) =>
            viewerRole ? channel.audienceRoles.includes(viewerRole) : true
          )
          .map<NotificationDelivery>((channel) => ({
            id: `delivery-${rule.id}-${channel.id}-${message.id}`,
            channelId: channel.id,
            channelName: `${channel.name}（${getChannelTypeLabel(channel.type)}）`,
            channelType: channel.type,
            ruleId: rule.id,
            ruleName: rule.name,
            status,
            preview: buildPreviewText(notification),
            payload: buildPayloadForChannel(channel.type, notification),
            audienceRoles: rule.audienceRoles,
            notification,
            createdAt: now
          }))
      );
  });
}

/**
 * Marks deliveries as sent without performing any network call. Used by the
 * dashboard simulate-send button so the audit trail still reflects the action.
 */
export function markDeliveriesAsSent(
  deliveries: NotificationDelivery[],
  now = new Date().toISOString()
): NotificationDelivery[] {
  return deliveries.map((delivery) => ({
    ...delivery,
    status: "sent",
    createdAt: now
  }));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace("T", " ").slice(0, 16);
}

import type {
  NotificationChannelType,
  UnifiedNotification
} from "../types";

const channelTypeLabels: Record<NotificationChannelType, string> = {
  feishu: "飞书",
  wecomBot: "企业微信",
  dingtalk: "钉钉",
  slack: "Slack",
  email: "邮件",
  generic: "通用 Webhook"
};

const levelEmoji: Record<UnifiedNotification["level"], string> = {
  Low: "ℹ️",
  Medium: "⚠️",
  High: "🚨"
};

/**
 * Returns the human-readable label for a notification channel type.
 */
export function getChannelTypeLabel(type: NotificationChannelType): string {
  return channelTypeLabels[type];
}

/**
 * Builds a markdown body shared by Feishu / WeChat Work / DingTalk.
 */
function buildMarkdownBody(notification: UnifiedNotification): string {
  const header = `${levelEmoji[notification.level]} **${notification.title}**`;
  const highlights = notification.highlights.length
    ? `\n${notification.highlights.map((item) => `- ${item}`).join("\n")}`
    : "";
  const link = notification.link ? `\n👉 [查看详情](${notification.link})` : "";

  return `${header}\n\n${notification.body}${highlights}${link}`;
}

/**
 * Builds a Feishu interactive card payload.
 */
export function buildFeishuPayload(notification: UnifiedNotification): Record<string, unknown> {
  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: notification.level === "High" ? "red" : notification.level === "Medium" ? "orange" : "blue",
        title: {
          tag: "plain_text",
          content: `${levelEmoji[notification.level]} ${notification.title}`
        }
      },
      elements: [
        {
          tag: "div",
          text: { tag: "lark_md", content: notification.body }
        },
        ...(notification.highlights.length
          ? [
              {
                tag: "div",
                text: {
                  tag: "lark_md",
                  content: notification.highlights.map((item) => `- ${item}`).join("\n")
                }
              }
            ]
          : []),
        ...(notification.link
          ? [
              {
                tag: "action",
                actions: [
                  {
                    tag: "button",
                    text: { tag: "plain_text", content: "查看详情" },
                    type: "primary",
                    url: notification.link
                  }
                ]
              }
            ]
          : [])
      ]
    }
  };
}

/**
 * Builds a WeChat Work group bot markdown payload.
 */
export function buildWecomPayload(notification: UnifiedNotification): Record<string, unknown> {
  return {
    msgtype: "markdown",
    markdown: {
      content: buildMarkdownBody(notification)
    }
  };
}

/**
 * Builds a DingTalk markdown payload (no signing applied here).
 */
export function buildDingtalkPayload(notification: UnifiedNotification): Record<string, unknown> {
  return {
    msgtype: "markdown",
    markdown: {
      title: notification.title,
      text: buildMarkdownBody(notification)
    },
    at: { isAtAll: notification.level === "High" }
  };
}

/**
 * Builds a Slack incoming webhook payload using blocks.
 */
export function buildSlackPayload(notification: UnifiedNotification): Record<string, unknown> {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${levelEmoji[notification.level]} ${notification.title}`,
        emoji: true
      }
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: notification.body }
    }
  ];

  if (notification.highlights.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: notification.highlights.map((item) => `• ${item}`).join("\n")
      }
    });
  }

  if (notification.link) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "查看详情" },
          url: notification.link
        }
      ]
    });
  }

  return { text: notification.title, blocks };
}

/**
 * Builds an email-friendly payload that downstream connectors can render.
 */
export function buildEmailPayload(notification: UnifiedNotification): Record<string, unknown> {
  return {
    subject: `[${levelEmoji[notification.level]} ${notification.level}] ${notification.title}`,
    text: `${notification.body}\n\n${notification.highlights.map((item) => `- ${item}`).join("\n")}`,
    link: notification.link ?? null
  };
}

/**
 * Builds a generic webhook payload without IM-specific framing.
 */
export function buildGenericPayload(notification: UnifiedNotification): Record<string, unknown> {
  return {
    title: notification.title,
    body: notification.body,
    level: notification.level,
    eventType: notification.eventType,
    highlights: notification.highlights,
    link: notification.link ?? null
  };
}

/**
 * Returns the IM-specific payload for the requested channel type.
 */
export function buildPayloadForChannel(
  type: NotificationChannelType,
  notification: UnifiedNotification
): Record<string, unknown> {
  switch (type) {
    case "feishu":
      return buildFeishuPayload(notification);
    case "wecomBot":
      return buildWecomPayload(notification);
    case "dingtalk":
      return buildDingtalkPayload(notification);
    case "slack":
      return buildSlackPayload(notification);
    case "email":
      return buildEmailPayload(notification);
    case "generic":
    default:
      return buildGenericPayload(notification);
  }
}

/**
 * Renders a short human-readable preview snippet for the dashboard list.
 */
export function buildPreviewText(notification: UnifiedNotification): string {
  const head = `[${notification.level}] ${notification.title}`;
  const body = notification.body.length > 120 ? `${notification.body.slice(0, 120)}...` : notification.body;
  return `${head} | ${body}`;
}

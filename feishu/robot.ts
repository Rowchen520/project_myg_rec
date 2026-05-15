import * as Lark from "@larksuiteoapi/node-sdk";
import { getFeishuAppConfig } from "@/feishu/config";

export type FeishuReceiveIdType = "chat_id" | "email" | "open_id" | "union_id" | "user_id";
export type FeishuRobotConnectionStatus = "idle" | "connecting" | "connected" | "degraded" | "stopped";

export interface FeishuNoticeCardContent {
  title: string;
  body: string;
}

export interface FeishuRobotConfig {
  appId: string;
  appSecret: string;
  baseDomain: string;
  noticeCardId: string;
  enabled: boolean;
  logEvents: boolean;
}

export interface SendNoticeCardInput {
  receiveIdType: FeishuReceiveIdType;
  receiveId: string;
  notification: FeishuNoticeCardContent;
  templateVariables?: Record<string, string>;
}

interface RobotRuntime {
  client: Lark.Client;
  wsClient: Lark.WSClient;
}

let runtime: RobotRuntime | null = null;
let connectionStatus: FeishuRobotConnectionStatus = "idle";
let lastError: string | null = null;
let startedAt: string | null = null;

export function getFeishuRobotConfig(env: NodeJS.ProcessEnv = process.env): FeishuRobotConfig {
  const appConfig = getFeishuAppConfig(env);
  const noticeCardId = readRequiredEnv(env, ["NOTICE_CARD_ID"]);

  return {
    appId: appConfig.appId,
    appSecret: appConfig.appSecret,
    baseDomain: appConfig.appBaseUrl,
    noticeCardId,
    enabled: env.FEISHU_BOT_ENABLED !== "false",
    logEvents: env.FEISHU_ROBOT_LOG_EVENTS === "true"
  };
}

export function buildRobotNotification(notification: FeishuNoticeCardContent): FeishuNoticeCardContent {
  const title = notification.title?.trim();
  const body = notification.body?.trim();

  if (!title) {
    throw new Error("飞书通知卡片缺少标题。请在业务触发时传入 notification.title。");
  }

  if (!body) {
    throw new Error("飞书通知卡片缺少正文。请在业务触发时传入 notification.body。");
  }

  return {
    title,
    body
  };
}

export function buildNoticeTemplateVariables(
  notification: FeishuNoticeCardContent,
  overrides: Record<string, string> = {}
): Record<string, string> {
  return {
    title: notification.title,
    body: notification.body,
    sent_at: formatChinaTimestamp(),
    ...overrides
  };
}

export async function ensureFeishuRobotStarted(): Promise<FeishuRobotConnectionStatus> {
  const config = getFeishuRobotConfig();
  if (!config.enabled) {
    connectionStatus = "stopped";
    return connectionStatus;
  }

  if (runtime) {
    return connectionStatus;
  }

  connectionStatus = "connecting";
  lastError = null;

  try {
    runtime = {
      client: new Lark.Client({
        appId: config.appId,
        appSecret: config.appSecret,
        domain: config.baseDomain
      }),
      wsClient: new Lark.WSClient({
        appId: config.appId,
        appSecret: config.appSecret,
        domain: config.baseDomain
      })
    };

    await Promise.resolve(runtime.wsClient.start({ eventDispatcher: buildEventDispatcher(config) }));
    connectionStatus = "connected";
    startedAt = new Date().toISOString();
    return connectionStatus;
  } catch (error) {
    runtime = null;
    connectionStatus = "degraded";
    lastError = error instanceof Error ? error.message : "飞书机器人启动失败。";
    throw error;
  }
}

export async function sendNoticeCard(input: SendNoticeCardInput) {
  const status = await ensureFeishuRobotStarted();
  if (status === "stopped") {
    throw new Error("飞书机器人当前已禁用。请检查 FEISHU_BOT_ENABLED 配置。");
  }
  if (!runtime) {
    throw new Error("飞书机器人尚未初始化完成。");
  }

  const config = getFeishuRobotConfig();
  const notification = buildRobotNotification(input.notification);
  const templateVariables = buildNoticeTemplateVariables(notification, input.templateVariables);

  const response = await runtime.client.im.v1.message.create({
    params: { receive_id_type: input.receiveIdType },
    data: {
      receive_id: input.receiveId,
      msg_type: "interactive",
      content: JSON.stringify({
        type: "template",
        data: {
          template_id: config.noticeCardId,
          template_variable: templateVariables
        }
      })
    }
  });

  return {
    ok: true,
    connectionStatus,
    notification,
    templateVariables,
    response
  };
}

export function getFeishuRobotStatus() {
  return {
    enabled: process.env.FEISHU_BOT_ENABLED !== "false",
    status: connectionStatus,
    startedAt,
    lastError,
    configured: hasRobotEnv(process.env)
  };
}

function buildEventDispatcher(config: FeishuRobotConfig) {
  return new Lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data: any) => {
      if (config.logEvents) {
        console.log("[feishu-robot] received message event", data);
      }

      const chatType = data?.message?.chat_type;
      const chatId = data?.message?.chat_id;
      const openId = data?.sender?.sender_id?.open_id;

      if (chatType === "group" && chatId) {
        return;
      }

      if (chatType === "p2p" && openId) {
        return;
      }
    },
    "card.action.trigger": async (data: any) => {
      if (config.logEvents) {
        console.log("[feishu-robot] received card action", data);
      }

      return {
        toast: {
          type: "info",
          content: "通知已收到。",
          i18n: {
            zh_cn: "通知已收到。",
            en_us: "Notification received."
          }
        }
      };
    }
  });
}

function readRequiredEnv(env: NodeJS.ProcessEnv, names: string[]): string {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`缺少飞书机器人环境变量：${names.join(" / ")}`);
}

function hasRobotEnv(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET && env.NOTICE_CARD_ID);
}

function formatChinaTimestamp(): string {
  return `${new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date())} (UTC+8)`;
}
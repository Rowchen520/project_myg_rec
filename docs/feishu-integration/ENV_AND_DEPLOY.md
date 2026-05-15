# Feishu Env Variables

本文件仅保留飞书集成涉及的环境变量解释。

## 1. 登录相关

- `FEISHU_APP_ID`：飞书应用 App ID。
- `FEISHU_APP_SECRET`：飞书应用 App Secret。
- `FEISHU_OAUTH_REDIRECT_URI`：飞书登录回调地址。

## 2. 机器人连接相关

- `FEISHU_APP_ID`：飞书统一应用 App ID，供登录、机器人、部门树接口共同使用。
- `FEISHU_APP_SECRET`：飞书统一应用 App Secret，供登录、机器人、部门树接口共同使用。
- `FEISHU_APP_BASE_URL`：飞书开放平台域名，如 `https://open.feishu.cn`。
- `FEISHU_BOT_ENABLED`：是否启用飞书机器人通道。
- `FEISHU_BOT_TENANT_KEY`：飞书租户标识。
- `FEISHU_BOT_DEFAULT_RECEIVER_MODE`：默认接收者标识模式，如 `open_id`。
- `FEISHU_BOT_HEARTBEAT_INTERVAL_MS`：长连接心跳周期，单位毫秒。
- `FEISHU_BOT_RETRY_MAX`：发送失败后的最大重试次数。

## 3. 卡片内容相关

- `NOTICE_CARD_ID`：飞书通知卡片模板 ID。
- `FEISHU_BOT_CARD_TEMPLATE_VERSION`：卡片模板版本。

说明：卡片标题与正文不再由环境变量提供，业务触发飞书卡片时必须显式传入 `title` 和 `body`。

## 4. 通知定时提醒相关

- `NOTIFICATION_REMINDER_CRON_TOKEN`：定时提醒入口的 Bearer Token。用于保护 `POST /api/notifications/reminders/overdue`，以及脚本 `npm run notifications:reminders` 调用该入口。
- `APP_URL`：定时提醒脚本请求平台地址时优先使用；未设置时回退到 `NEXT_PUBLIC_APP_URL`，再回退到 `http://localhost:3000`。

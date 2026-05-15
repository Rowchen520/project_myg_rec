import { NextResponse } from "next/server";
import { sendOverdueUnreadNotificationReminders } from "@/lib/services/user-notifications";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  const expectedToken = process.env.NOTIFICATION_REMINDER_CRON_TOKEN?.trim();

  if (!expectedToken) {
    return NextResponse.json({ error: "服务端未配置 NOTIFICATION_REMINDER_CRON_TOKEN。" }, { status: 503 });
  }

  if (!bearer || bearer !== expectedToken) {
    return NextResponse.json({ error: "定时提醒入口鉴权失败。" }, { status: 401 });
  }

  const result = await sendOverdueUnreadNotificationReminders();
  return NextResponse.json(result);
}
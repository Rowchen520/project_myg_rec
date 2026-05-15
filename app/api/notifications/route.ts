import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  listUserNotifications,
  markUserNotificationsRead,
  sendUserNotifications,
  type SendUserNotificationInput
} from "@/lib/services/user-notifications";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const notifications = await listUserNotifications(user.id);
    return NextResponse.json({ notifications });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as Partial<SendUserNotificationInput>;
    const result = await sendUserNotifications({
      recipientUserIds: body.recipientUserIds ?? [],
      recipientOpenIds: body.recipientOpenIds ?? [],
      title: body.title ?? "",
      body: body.body ?? "",
      level: body.level,
      source: body.source,
      link: body.link,
      payload: body.payload
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as { notificationIds?: string[] };
    const result = await markUserNotificationsRead({
      userId: user.id,
      notificationIds: body.notificationIds
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
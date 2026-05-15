import { NextResponse } from "next/server";
import { getFeishuRobotStatus, sendNoticeCard } from "@/feishu/robot";
import {
  assertPermission,
  getAuthContextFromRequest,
  toErrorResponse
} from "@/lib/services/auth-context";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContextFromRequest(request);
    assertPermission(auth.user.role, "manageNotifications");

    return NextResponse.json(getFeishuRobotStatus());
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthContextFromRequest(request);
    assertPermission(auth.user.role, "manageNotifications");

    const body = (await request.json().catch(() => ({}))) as {
      receiveId?: string;
      receiveIdType?: "chat_id" | "email" | "open_id" | "union_id" | "user_id";
      title?: string;
      body?: string;
      templateVariables?: Record<string, string>;
    };

    if (!body.receiveId?.trim()) {
      return NextResponse.json({ error: "缺少 receiveId。" }, { status: 400 });
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "缺少 title。" }, { status: 400 });
    }

    if (!body.body?.trim()) {
      return NextResponse.json({ error: "缺少 body。" }, { status: 400 });
    }

    const result = await sendNoticeCard({
      receiveId: body.receiveId.trim(),
      receiveIdType: body.receiveIdType ?? "open_id",
      notification: {
        title: body.title.trim(),
        body: body.body.trim()
      },
      templateVariables: body.templateVariables
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
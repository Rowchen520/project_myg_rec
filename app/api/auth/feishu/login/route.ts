import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createOAuthSession,
  FEISHU_REDIRECT_COOKIE,
  FEISHU_STATE_COOKIE,
  FEISHU_STATE_MAX_AGE,
  FeishuAuthError
} from "@/feishu/oauth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const session = createOAuthSession(searchParams.get("redirectTo") ?? undefined);
    const store = await cookies();

    store.set({
      name: FEISHU_STATE_COOKIE,
      value: session.state,
      path: "/",
      maxAge: FEISHU_STATE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax"
    });
    store.set({
      name: FEISHU_REDIRECT_COOKIE,
      value: session.redirectTo,
      path: "/",
      maxAge: FEISHU_STATE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax"
    });

    return NextResponse.redirect(session.authorizeUrl);
  } catch (error) {
    const message = error instanceof FeishuAuthError || error instanceof Error ? error.message : "飞书登录初始化失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
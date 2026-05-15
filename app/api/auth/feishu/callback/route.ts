import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  FEISHU_REDIRECT_COOKIE,
  FEISHU_STATE_COOKIE,
  FeishuAuthError,
  findOrCreateUserFromFeishuProfile,
  resolveFeishuProfile
} from "@/feishu/oauth";
import { logFeishuAuthEvent } from "@/feishu/audit";
import { getTenantKey } from "@/feishu/account";
import { buildSessionCookie } from "@/lib/services/session-cookie";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const store = await cookies();
  const expectedState = store.get(FEISHU_STATE_COOKIE)?.value;
  const redirectTo = store.get(FEISHU_REDIRECT_COOKIE)?.value || "/";

  store.delete(FEISHU_STATE_COOKIE);
  store.delete(FEISHU_REDIRECT_COOKIE);

  if (error) {
    await logFeishuAuthEvent({
      event: "LOGIN_FAILED",
      success: false,
      tenantKey: getTenantKey(),
      message: error,
      redirectTo
    });
    return NextResponse.redirect(new URL(`${redirectTo}?feishuLoginError=${encodeURIComponent(error)}`, url.origin));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    await logFeishuAuthEvent({
      event: "LOGIN_FAILED",
      success: false,
      tenantKey: getTenantKey(),
      message: "state 校验失败",
      redirectTo
    });
    return NextResponse.json({ error: "飞书登录状态校验失败，请重新发起登录。" }, { status: 400 });
  }

  try {
    const profile = await resolveFeishuProfile(code);
    const result = await findOrCreateUserFromFeishuProfile(profile);
    await logFeishuAuthEvent({
      event: "LOGIN_SUCCEEDED",
      success: true,
      userId: result.userId,
      tenantKey: getTenantKey(),
      openId: profile.openId,
      unionId: profile.unionId,
      message: result.isNewUser ? "首次飞书登录并自动建档。" : "飞书登录成功。",
      redirectTo
    });

    const target = result.needsProfileCompletion ? "/my/feishu?onboarding=1" : redirectTo;
    const response = NextResponse.redirect(new URL(target, url.origin));
    response.cookies.set(buildSessionCookie(profile.openId));
    return response;
  } catch (authError) {
    const message = authError instanceof FeishuAuthError || authError instanceof Error
      ? authError.message
      : "飞书登录失败。";
    await logFeishuAuthEvent({
      event: "LOGIN_FAILED",
      success: false,
      tenantKey: getTenantKey(),
      message,
      redirectTo
    });
    return NextResponse.redirect(new URL(`${redirectTo}?feishuLoginError=${encodeURIComponent(message)}`, url.origin));
  }
}
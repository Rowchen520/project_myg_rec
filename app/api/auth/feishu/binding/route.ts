import { NextResponse } from "next/server";
import { unlinkFeishuAccount } from "@/feishu/account";
import { getCurrentUserFromSession } from "@/lib/services/auth-server";
import { buildClearedSessionCookie } from "@/lib/services/session-cookie";
import { getCurrentUserBinding } from "@/feishu/oauth";

export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const binding = await getCurrentUserBinding(user.id);
  return NextResponse.json({
    connected: Boolean(binding),
    feishuUser: binding
      ? {
          openId: binding.openId,
          unionId: binding.unionId,
          name: binding.displayName,
          avatarUrl: binding.avatarUrl,
          email: binding.email,
          mobile: binding.mobile,
          profileCompletedAt: binding.profileCompletedAt,
          lastLoginAt: binding.lastLoginAt
        }
      : null
  });
}

export async function DELETE() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  await unlinkFeishuAccount(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearedSessionCookie());
  return response;
}
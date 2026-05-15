import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildClearedSessionCookie, buildSessionCookie } from "@/lib/services/session-cookie";

/**
 * Switches the active demo user by storing an identity value in an HTTP cookie that
 * `auth-server.ts` reads from server components. POST `{ openId }` or legacy `{ userId }`.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { userId?: string; openId?: string; identity?: string };
  const identity = body.openId ?? body.identity ?? body.userId;

  if (!identity) {
    return NextResponse.json({ error: "缺少 openId 或 userId。" }, { status: 400 });
  }

  const store = await cookies();
  store.set(buildSessionCookie(identity));

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.set(buildClearedSessionCookie());
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "pm-active-user-id";

/**
 * Switches the active demo user by storing their id in an HTTP cookie that
 * `auth-server.ts` reads from server components. POST `{ userId }`.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  if (!body.userId) {
    return NextResponse.json({ error: "缺少 userId。" }, { status: 400 });
  }

  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: body.userId,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
    sameSite: "lax"
  });

  return NextResponse.json({ ok: true });
}

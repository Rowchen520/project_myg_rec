import { NextResponse } from "next/server";
import { resolveAgentAuthFromRequest } from "@/lib/agent/auth";
import { invokeTool } from "@/lib/agent/invoke";

export async function POST(request: Request) {
  const auth = await resolveAgentAuthFromRequest(request).catch((error) => ({
    error: error instanceof Error ? error.message : "鉴权失败。"
  }));
  if ("error" in auth) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: auth.error } }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    input?: unknown;
    dryRun?: boolean;
    confirm?: boolean;
    parentInvocationId?: string;
  };
  if (!body.name) {
    return NextResponse.json({ ok: false, error: { code: "bad_request", message: "缺少工具名称。" } }, { status: 400 });
  }

  const result = await invokeTool(body.name, body.input ?? {}, {
    auth,
    dryRun: body.dryRun,
    confirm: body.confirm,
    parentInvocationId: body.parentInvocationId,
    idempotencyKey: request.headers.get("idempotency-key") ?? undefined
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

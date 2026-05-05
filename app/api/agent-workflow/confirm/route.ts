import { NextResponse } from "next/server";
import { invokeAgentTool } from "@/lib/agent/sdk";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import type { AgentAnalysis } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      draftId?: string;
      analysis?: AgentAnalysis;
    };
    if (!body.draftId) {
      return NextResponse.json({ error: "缺少 draftId。" }, { status: 400 });
    }

    const { user } = await getAuthContextFromRequest(request);
    const result = await invokeAgentTool(
      "agent.breakdown.confirm",
      { draftId: body.draftId, analysis: body.analysis },
      {
        user,
        source: "api:agent-workflow.confirm",
        confirm: true,
        idempotencyKey: `agent-confirm:${user.id}:${body.draftId}`
      }
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error?.message ?? "确认草稿失败。" }, { status: 400 });
    }

    return NextResponse.json(result.output, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

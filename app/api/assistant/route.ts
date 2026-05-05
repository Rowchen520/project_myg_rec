import { NextResponse } from "next/server";
import { analyzeWithProvider } from "@/lib/agent/provider";
import { invokeAgentTool } from "@/lib/agent/sdk";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import type { AgentAnalysis } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      projectId?: string | null;
      draft?: boolean;
    };
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const { user } = await getAuthContextFromRequest(request);
    const hasProjectId = Object.prototype.hasOwnProperty.call(body, "projectId");
    const projectId = hasProjectId
      ? body.projectId ?? null
      : user.managedProjectIds[0] ?? user.participatingProjectIds[0] ?? null;

    if (!projectId && !hasProjectId) {
      return NextResponse.json({ error: "当前用户没有可用项目。" }, { status: 400 });
    }

    if (body.draft === false) {
      return NextResponse.json({
        provider: process.env.AI_PROVIDER ?? "mock",
        analysis: await analyzeWithProvider(prompt)
      });
    }

    const result = await invokeAgentTool(
      "agent.breakdown.draft",
      { prompt, projectId },
      {
        user,
        source: "api:assistant",
        idempotencyKey: `assistant:${user.id}:${projectId ?? "personal"}:${prompt}`
      }
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error?.message ?? "生成 AI 草稿失败。" }, { status: 400 });
    }

    return NextResponse.json({
      provider: process.env.AI_PROVIDER ?? "mock",
      ...(result.output as { draftId: string; analysis: AgentAnalysis })
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

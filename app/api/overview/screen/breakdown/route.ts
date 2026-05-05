import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";
import { breakdownRequirementForBigScreen } from "@/lib/services/big-screen-breakdown";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      documentText?: string;
      projectId?: string;
      token?: string;
      projectStartDate?: string;
    };
    const documentText = typeof body.documentText === "string" ? body.documentText.trim() : "";
    if (!documentText) {
      return NextResponse.json({ error: "缺少需求文档内容。" }, { status: 400 });
    }

    const anonymousAllowed = body.token === (process.env.BIG_SCREEN_ANONYMOUS_TOKEN ?? "demo-big-screen");
    const { snapshot } = await loadWorkspaceSnapshot(anonymousAllowed ? undefined : {});
    const project = snapshot.projects.find((item) => item.id === body.projectId || item.identifier === body.projectId);
    if (!project) {
      return NextResponse.json({ error: "项目不存在。" }, { status: 404 });
    }

    if (!anonymousAllowed) {
      const { user } = await getAuthContextFromRequest(request);
      if (!can(user.role, "useAgentTool")) {
        return NextResponse.json({ error: "当前用户无权使用 AI Agent 拆解。" }, { status: 403 });
      }
    }

    const plan = await breakdownRequirementForBigScreen({
      documentText,
      projectName: project.name,
      projectStartDate: body.projectStartDate ?? project.startDate ?? new Date().toISOString()
    });

    return NextResponse.json({
      provider: process.env.AI_PROVIDER ?? "mock",
      plan
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

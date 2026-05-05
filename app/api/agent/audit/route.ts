import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "viewAgentAudit")) {
      return NextResponse.json({ error: "当前角色无权查看 Agent 审计。" }, { status: 403 });
    }

    const url = new URL(request.url);
    const toolName = url.searchParams.get("toolName") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const invocations = await prisma.agentToolInvocation.findMany({
      where: {
        toolName,
        status,
        ...(user.role === "admin" ? {} : { callerUserId: user.id })
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return NextResponse.json({ invocations });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { createScenario } from "@/lib/services/big-screen-plan";

/**
 * Creates a draft scenario forked from the current baseline.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string;
      name?: string;
    };
    if (!body.projectId) {
      return NextResponse.json({ error: "缺少 projectId。" }, { status: 400 });
    }

    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageProjects")) {
      return NextResponse.json({ error: "当前用户无权创建大屏计划草稿。" }, { status: 403 });
    }

    const scenario = await createScenario({
      projectId: body.projectId,
      user,
      name: body.name
    });

    return NextResponse.json({
      scenario: {
        id: scenario.id,
        name: scenario.name,
        status: scenario.status.toLowerCase(),
        baselineId: scenario.baselineId,
        createdByUserId: scenario.createdByUserId,
        createdAt: scenario.createdAt.toISOString(),
        updatedAt: scenario.updatedAt.toISOString()
      }
    }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { applyScenario } from "@/lib/services/big-screen-plan";

/**
 * Applies a scenario draft back to the WorkPackage table and bumps a baseline.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageProjects")) {
      return NextResponse.json({ error: "当前用户无权应用大屏计划草稿。" }, { status: 403 });
    }
    await applyScenario({ scenarioId: id, user });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { listScenarioChanges } from "@/lib/services/big-screen-plan";

/**
 * Lists the audit-ready change events recorded against a scenario draft.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageProjects")) {
      return NextResponse.json({ error: "当前用户无权查看大屏计划审计。" }, { status: 403 });
    }
    const rows = await listScenarioChanges(id);
    return NextResponse.json({
      changes: rows.map((row) => ({
        id: row.id,
        scenarioId: row.scenarioId,
        changeType: row.changeType,
        targetRef: row.targetRef,
        payload: safeJson(row.payloadJson),
        createdAt: row.createdAt.toISOString()
      }))
    });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  discardScenario,
  patchScenario,
  type PlanChangeInput,
  type PlanModel
} from "@/lib/services/big-screen-plan";

/**
 * Applies a batch of changes to the scenario and persists the new draft.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      nextDraft?: PlanModel;
      changes?: PlanChangeInput[];
    };
    if (!body.nextDraft || !Array.isArray(body.changes)) {
      return NextResponse.json({ error: "缺少 nextDraft 或 changes。" }, { status: 400 });
    }

    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageProjects")) {
      return NextResponse.json({ error: "当前用户无权编辑大屏计划草稿。" }, { status: 403 });
    }

    const plan = await patchScenario({
      scenarioId: id,
      user,
      changes: body.changes,
      nextDraft: body.nextDraft
    });
    return NextResponse.json({ plan });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

/**
 * Discards a scenario without writing back to the baseline.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageProjects")) {
      return NextResponse.json({ error: "当前用户无权废弃大屏计划草稿。" }, { status: 403 });
    }
    await discardScenario({ scenarioId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

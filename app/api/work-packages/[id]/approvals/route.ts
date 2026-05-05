import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  addWorkPackageApproval,
  type WorkPackageApprovalInput
} from "@/lib/services/work-package-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Records a project-manager approval decision on a work package.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "工作项 id 必须为数字。" }, { status: 400 });
    }

    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as WorkPackageApprovalInput;
    const approval = await addWorkPackageApproval(numericId, body, user);

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

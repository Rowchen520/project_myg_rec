import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  addWorkPackageComment,
  type WorkPackageCommentInput
} from "@/lib/services/work-package-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Persists a comment, decision, blocker, or evidence record on a work package.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "工作项 id 必须为数字。" }, { status: 400 });
    }

    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as WorkPackageCommentInput;
    const comment = await addWorkPackageComment(numericId, body, user);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

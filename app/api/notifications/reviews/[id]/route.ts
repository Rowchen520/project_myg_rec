import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  completeNotificationReviewRequest,
  type CompleteNotificationReviewInput
} from "@/lib/services/user-notifications";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as Partial<CompleteNotificationReviewInput>;
    const reviewRequest = await completeNotificationReviewRequest(
      id,
      {
        status: body.status === "approved" ? "approved" : "rejected",
        resultComment: body.resultComment,
        resultTitle: body.resultTitle,
        resultBody: body.resultBody,
        link: body.link,
        payload: body.payload
      },
      user
    );

    return NextResponse.json({ reviewRequest });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
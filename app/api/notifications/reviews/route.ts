import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  createNotificationReviewRequest,
  type CreateNotificationReviewInput
} from "@/lib/services/user-notifications";

export async function POST(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as Partial<CreateNotificationReviewInput>;
    const reviewRequest = await createNotificationReviewRequest(
      {
        reviewerUserId: body.reviewerUserId,
        reviewerOpenId: body.reviewerOpenId,
        reviewedUserId: body.reviewedUserId,
        reviewedOpenId: body.reviewedOpenId,
        title: body.title ?? "",
        body: body.body ?? "",
        link: body.link,
        payload: body.payload
      },
      user
    );

    return NextResponse.json({ reviewRequest }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import {
  listPlatformFeatureFlags,
  updatePlatformFeatureFlag,
  type FeatureFlagPatchInput
} from "@/lib/services/feature-flags";

export async function GET() {
  try {
    return NextResponse.json({ flags: await listPlatformFeatureFlags() });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as FeatureFlagPatchInput;
    const flag = await updatePlatformFeatureFlag(body, user);

    return NextResponse.json({ flag });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

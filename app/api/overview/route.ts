import { NextResponse } from "next/server";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { buildPlatformOverviewSnapshot } from "@/lib/services/platform-overview";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    const enabled = await isModuleEnabledForUser("platformOverview", user);
    if (!enabled) {
      return NextResponse.json({ error: "平台总览已被管理员关闭。" }, { status: 403 });
    }

    const { snapshot } = await loadWorkspaceSnapshot({ userId: user.id });
    return NextResponse.json(buildPlatformOverviewSnapshot(snapshot, user));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

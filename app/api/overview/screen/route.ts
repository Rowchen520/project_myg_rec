import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { loadScreenPlan } from "@/lib/services/big-screen-plan";

/**
 * Returns the canonical screen plan: baseline + active scenario.
 *
 * - With a valid anonymous token (used by big-screen TVs) we serve the baseline only.
 * - Otherwise the request must come from a user with `viewBigScreen`.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const projectId = url.searchParams.get("projectId") ?? "proj-ai-pm";
    const scenarioId = url.searchParams.get("scenarioId") ?? undefined;
    const anonymousAllowed = token && token === (process.env.BIG_SCREEN_ANONYMOUS_TOKEN ?? "demo-big-screen");

    if (anonymousAllowed) {
      const result = await loadScreenPlan({ projectId, scenarioId, anonymousFallback: true });
      return NextResponse.json(result);
    }

    const { user } = await getAuthContextFromRequest(request);
    const enabled = await isModuleEnabledForUser("bigScreen", user);
    if (!enabled || !can(user.role, "viewBigScreen")) {
      return NextResponse.json({ error: "平台大屏已关闭或当前用户无权访问。" }, { status: 403 });
    }

    const result = await loadScreenPlan({ projectId, scenarioId, user });
    return NextResponse.json(result);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

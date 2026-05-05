import { NextResponse } from "next/server";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";

/**
 * Workspace bootstrap endpoint. Returns the snapshot the OpenProject-style
 * shell needs: projects (with hierarchy + enabled modules), people,
 * notification config, and steward messages.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const result = await loadWorkspaceSnapshot({ userId, projectId });

  return NextResponse.json({
    source: result.source,
    warning: result.warning,
    projects: result.snapshot.projects,
    people: result.snapshot.people,
    users: result.snapshot.users,
    counts: {
      workPackages: result.snapshot.workPackages.length,
      stewardMessages: result.snapshot.stewardMessages.length
    }
  });
}

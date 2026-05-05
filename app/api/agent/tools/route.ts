import { NextResponse } from "next/server";
import { listTools, serializeTool } from "@/lib/agent/tools/registry";
import { resolveAgentAuthFromRequest } from "@/lib/agent/auth";
import { can } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    const auth = await resolveAgentAuthFromRequest(request);
    const tools = listTools()
      .filter((tool) => tool.requiredPermissions.every((permission) => can(auth.user.role, permission)))
      .filter((tool) => !auth.allowedTools?.length || auth.allowedTools.includes(tool.name))
      .map(serializeTool);

    return NextResponse.json({ tools });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取工具清单失败。" },
      { status: 401 }
    );
  }
}

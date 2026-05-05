import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { createWorkPackage, type WorkPackageCreateInput } from "@/lib/services/work-package-workflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Splits a big-screen node into executable task items assigned to team members.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parentId = resolveWorkPackageId(id);
    if (typeof parentId !== "number") {
      return NextResponse.json({ error: "节点 id 必须包含工作项编号。" }, { status: 400 });
    }

    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "assignWorkPackages")) {
      return NextResponse.json({ error: "当前用户无权拆解节点任务项次。" }, { status: 403 });
    }

    const parent = await prisma.workPackage.findUnique({ where: { id: parentId } });
    if (!parent?.projectId) {
      return NextResponse.json({ error: "节点不存在或未绑定项目。" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Partial<WorkPackageCreateInput>;
    if (!body.subject?.trim()) {
      return NextResponse.json({ error: "任务项次标题不能为空。" }, { status: 400 });
    }

    const task = await createWorkPackage(
      {
        projectId: parent.projectId,
        type: "task",
        subject: body.subject,
        description: body.description,
        assigneeId: body.assigneeId,
        parentId,
        startDate: body.startDate,
        dueDate: body.dueDate,
        estimateHours: body.estimateHours,
        difficulty: body.difficulty,
        riskLevel: body.riskLevel,
        lastProgressNote: body.lastProgressNote,
        requiredSkills: body.requiredSkills
      },
      user
    );

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

function resolveWorkPackageId(nodeId: string): number | undefined {
  const raw = nodeId.startsWith("wp-") ? nodeId.slice(3) : nodeId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

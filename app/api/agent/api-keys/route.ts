import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { generateAgentApiKey } from "@/lib/agent/auth";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageAgentApiKeys")) {
      return NextResponse.json({ error: "当前角色无权管理 Agent API Key。" }, { status: 403 });
    }

    const keys = await prisma.agentApiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        allowedTools: true,
        allowedRoles: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true
      }
    });
    return NextResponse.json({ keys });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageAgentApiKeys")) {
      return NextResponse.json({ error: "当前角色无权管理 Agent API Key。" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      allowedTools?: string[];
      allowedRoles?: string[];
      expiresAt?: string;
    };
    const generated = generateAgentApiKey();
    const key = await prisma.agentApiKey.create({
      data: {
        name: body.name?.trim() || "Agent API Key",
        keyPrefix: generated.prefix,
        hashedKey: generated.hash,
        allowedTools: JSON.stringify(body.allowedTools ?? []),
        allowedRoles: JSON.stringify(body.allowedRoles ?? []),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByUserId: user.id
      }
    });

    return NextResponse.json({ key: { ...key, secret: generated.secret } }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await getAuthContextFromRequest(request);
    if (!can(user.role, "manageAgentApiKeys")) {
      return NextResponse.json({ error: "当前角色无权管理 Agent API Key。" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id。" }, { status: 400 });
    }
    await prisma.agentApiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

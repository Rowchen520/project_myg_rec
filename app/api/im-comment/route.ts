import { NextResponse } from "next/server";
import {
  importExternalWorkPackageComment,
  type ExternalWorkPackageCommentPayload
} from "@/lib/collaboration";
import { getAuthContextFromRequest, toErrorResponse } from "@/lib/services/auth-context";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";
import { addWorkPackageComment } from "@/lib/services/work-package-workflow";

/**
 * Previews an inbound IM message mapped to a work package comment. Add
 * `?persist=1` to write the mapped comment through the auditable evidence path.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const shouldPersist = url.searchParams.get("persist") === "1";
    const body = (await request.json().catch(() => ({}))) as Partial<ExternalWorkPackageCommentPayload>;
    const payload = normalizePayload(body);

    if (!payload) {
      return NextResponse.json(
        { status: "unmatched", reason: "缺少 source、text、externalMessageId 或 senderName。" },
        { status: 400 }
      );
    }

    const { snapshot } = await loadWorkspaceSnapshot();
    const preview = importExternalWorkPackageComment(payload, snapshot, new Date());
    if (!shouldPersist || preview.status !== "imported" || !preview.comment) {
      return NextResponse.json(preview);
    }

    const { user } = await getAuthContextFromRequest(request);
    const comment = await addWorkPackageComment(
      preview.comment.workPackageId,
      {
        body: preview.comment.body,
        type: preview.comment.type,
        mentionsPersonIds: preview.comment.mentionsPersonIds,
        source: preview.comment.source,
        sourceChannelId: preview.comment.sourceChannelId,
        externalMessageId: preview.comment.externalMessageId,
        externalThreadId: preview.comment.externalThreadId,
        authorDisplayName: preview.comment.authorDisplayName,
        authorPersonId: preview.comment.authorPersonId
      },
      user
    );

    return NextResponse.json({ status: "imported", comment }, { status: 201 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export function GET() {
  return NextResponse.json({
    objective: "IM 评论回流预览接口",
    example: {
      source: "feishu",
      text: "#3 已补充截图证据，请 @产品负责人 复核",
      externalMessageId: "om_demo_preview",
      senderName: "前端开发",
      sourceChannelId: "ch-feishu-core"
    }
  });
}

function normalizePayload(
  body: Partial<ExternalWorkPackageCommentPayload>
): ExternalWorkPackageCommentPayload | null {
  if (!body.source || !body.text || !body.externalMessageId || !body.senderName) {
    return null;
  }

  return {
    source: body.source,
    text: body.text,
    externalMessageId: body.externalMessageId,
    senderName: body.senderName,
    workPackageId: body.workPackageId,
    senderPersonId: body.senderPersonId,
    sourceChannelId: body.sourceChannelId,
    externalThreadId: body.externalThreadId
  };
}

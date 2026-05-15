import { prisma } from "@/lib/prisma";
import { sendNoticeCard } from "@/feishu/robot";
import type { NotificationLevel, NotificationReviewRequest, User, UserNotification } from "@/lib/types";
import { ServiceError } from "./auth-context";

export interface SendUserNotificationInput {
  recipientUserIds?: string[];
  recipientOpenIds?: string[];
  title: string;
  body: string;
  level?: NotificationLevel;
  source?: string;
  link?: string;
  payload?: Record<string, unknown>;
}

export interface MarkUserNotificationsReadInput {
  userId: string;
  notificationIds?: string[];
}

export interface UserNotificationSummary {
  unreadCount: number;
}

const REVIEW_REQUEST_NOTIFICATION_SOURCE = "notification-review-request";
const REVIEW_RESULT_NOTIFICATION_SOURCE = "notification-review-result";

export interface OverdueUnreadReminderResult {
  scannedNotifications: number;
  remindedNotifications: number;
  notifiedUsers: number;
  skippedUsers: number;
}

export interface CreateNotificationReviewInput {
  reviewerUserId?: string;
  reviewerOpenId?: string;
  reviewedUserId?: string;
  reviewedOpenId?: string;
  title: string;
  body: string;
  link?: string;
  payload?: Record<string, unknown>;
}

export interface CompleteNotificationReviewInput {
  status: "approved" | "rejected";
  resultComment?: string;
  resultTitle?: string;
  resultBody?: string;
  link?: string;
  payload?: Record<string, unknown>;
}

export async function listUserNotifications(userId: string, take = 50): Promise<UserNotification[]> {
  const rows = await prisma.userNotification.findMany({
    where: { recipientUserId: userId },
    include: {
      recipient: {
        include: {
          feishuBinding: {
            select: {
              openId: true,
              revokedAt: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take
  });

  return rows.map((row) => ({
    id: row.id,
    recipientUserId: row.recipientUserId,
    recipientOpenId: row.recipient.feishuBinding?.revokedAt ? undefined : row.recipient.feishuBinding?.openId,
    title: row.title,
    body: row.body,
    level: mapRiskLevel(row.level),
    source: row.source,
    link: row.link ?? undefined,
    payload: safeJson(row.payloadJson),
    readAt: row.readAt?.toISOString(),
    unreadReminderSentAt: row.unreadReminderSentAt?.toISOString(),
    createdAt: row.createdAt.toISOString()
  }));
}

export async function listInboxUserNotifications(userId: string, take = 50): Promise<UserNotification[]> {
  const notifications = await listUserNotifications(userId, take);
  return notifications.filter((notification) => notification.source !== REVIEW_REQUEST_NOTIFICATION_SOURCE);
}

export async function getUserNotificationSummary(userId: string): Promise<UserNotificationSummary> {
  const [unreadNotificationCount, pendingReviewCount] = await Promise.all([
    prisma.userNotification.count({
      where: {
        recipientUserId: userId,
        readAt: null,
        source: {
          not: REVIEW_REQUEST_NOTIFICATION_SOURCE
        }
      }
    }),
    prisma.notificationReviewRequest.count({
      where: {
        reviewerUserId: userId,
        status: "PENDING"
      }
    })
  ]);

  return { unreadCount: unreadNotificationCount + pendingReviewCount };
}

export async function listPendingNotificationReviewRequests(userId: string): Promise<NotificationReviewRequest[]> {
  const rows = await prisma.notificationReviewRequest.findMany({
    where: {
      reviewerUserId: userId,
      status: "PENDING"
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map(mapNotificationReviewRequest);
}

export async function sendOverdueUnreadNotificationReminders(options: { userId?: string } = {}): Promise<OverdueUnreadReminderResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const overdueNotifications = await prisma.userNotification.findMany({
    where: {
      ...(options.userId ? { recipientUserId: options.userId } : {}),
      readAt: null,
      unreadReminderSentAt: null,
      createdAt: { lte: cutoff }
    },
    include: {
      recipient: {
        include: {
          feishuBinding: {
            select: {
              openId: true,
              revokedAt: true
            }
          }
        }
      }
    }
  });

  if (!overdueNotifications.length) {
    return {
      scannedNotifications: 0,
      remindedNotifications: 0,
      notifiedUsers: 0,
      skippedUsers: 0
    };
  }

  const notificationsByUser = new Map<string, typeof overdueNotifications>();
  for (const notification of overdueNotifications) {
    const existing = notificationsByUser.get(notification.recipientUserId);
    if (existing) {
      existing.push(notification);
    } else {
      notificationsByUser.set(notification.recipientUserId, [notification]);
    }
  }

  let remindedNotifications = 0;
  let notifiedUsers = 0;
  let skippedUsers = 0;

  for (const notifications of notificationsByUser.values()) {
    const openId = notifications[0]?.recipient.feishuBinding?.revokedAt
      ? undefined
      : notifications[0]?.recipient.feishuBinding?.openId;

    if (!openId) {
      skippedUsers += 1;
      continue;
    }

    try {
      await sendNoticeCard({
        receiveIdType: "open_id",
        receiveId: openId,
        notification: {
          title: "通知中心提醒",
          body: "您有消息超过一天未处理，请前往通知中心查看。"
        }
      });

      await prisma.userNotification.updateMany({
        where: {
          id: { in: notifications.map((item) => item.id) }
        },
        data: {
          unreadReminderSentAt: new Date()
        }
      });

      notifiedUsers += 1;
      remindedNotifications += notifications.length;
    } catch (error) {
      console.error("[notifications] failed to send overdue unread reminder", error);
    }
  }

  return {
    scannedNotifications: overdueNotifications.length,
    remindedNotifications,
    notifiedUsers,
    skippedUsers
  };
}

export async function createNotificationReviewRequest(
  input: CreateNotificationReviewInput,
  requester: User
): Promise<NotificationReviewRequest> {
  const reviewerUserId = await resolveSingleUserId({
    userId: input.reviewerUserId,
    openId: input.reviewerOpenId,
    label: "审核人"
  });
  const reviewedUserId = await resolveSingleUserId({
    userId: input.reviewedUserId,
    openId: input.reviewedOpenId,
    label: "被审核用户"
  });

  if (!input.title.trim()) {
    throw new ServiceError("审核消息标题不能为空。", 400);
  }

  if (!input.body.trim()) {
    throw new ServiceError("审核消息正文不能为空。", 400);
  }

  const created = await prisma.notificationReviewRequest.create({
    data: {
      requesterUserId: requester.id,
      reviewerUserId,
      reviewedUserId,
      title: input.title.trim(),
      body: input.body.trim(),
      link: input.link?.trim() || null,
      payloadJson: JSON.stringify(input.payload ?? {})
    }
  });

  await sendUserNotifications({
    recipientUserIds: [reviewerUserId],
    title: input.title,
    body: input.body,
    level: "Medium",
    source: REVIEW_REQUEST_NOTIFICATION_SOURCE,
    link: input.link,
    payload: {
      kind: "notification-review-request",
      reviewRequestId: created.id,
      requesterUserId: requester.id,
      reviewedUserId,
      ...(input.payload ?? {})
    }
  });

  return mapNotificationReviewRequest(created);
}

export async function completeNotificationReviewRequest(
  reviewRequestId: string,
  input: CompleteNotificationReviewInput,
  reviewer: User
): Promise<NotificationReviewRequest> {
  const trimmedId = reviewRequestId.trim();
  if (!trimmedId) {
    throw new ServiceError("缺少审核请求 id。", 400);
  }

  const existing = await prisma.notificationReviewRequest.findUnique({
    where: { id: trimmedId }
  });

  if (!existing) {
    throw new ServiceError("未找到审核请求。", 404);
  }

  if (existing.reviewerUserId !== reviewer.id) {
    throw new ServiceError("当前用户无权处理该审核请求。", 403);
  }

  if (existing.status !== "PENDING") {
    throw new ServiceError("该审核请求已处理，不能重复提交结果。", 409);
  }

  const resultComment = input.resultComment?.trim();
  const nextStatus = input.status === "approved" ? "APPROVED" : "REJECTED";
  const updated = await prisma.notificationReviewRequest.update({
    where: { id: trimmedId },
    data: {
      status: nextStatus,
      resultComment: resultComment || null,
      reviewedAt: new Date()
    }
  });

  await prisma.userNotification.updateMany({
    where: {
      recipientUserId: reviewer.id,
      source: REVIEW_REQUEST_NOTIFICATION_SOURCE,
      readAt: null,
      payloadJson: {
        contains: `"reviewRequestId":"${existing.id}"`
      }
    },
    data: {
      readAt: new Date()
    }
  });

  await sendUserNotifications({
    recipientUserIds: [existing.reviewedUserId],
    title: input.resultTitle?.trim() || (input.status === "approved" ? "审核通过通知" : "审核未通过通知"),
    body: input.resultBody?.trim() || buildNotificationReviewResultBody(reviewer.name, input.status, resultComment),
    level: input.status === "approved" ? "Low" : "High",
    source: REVIEW_RESULT_NOTIFICATION_SOURCE,
    link: input.link?.trim() || existing.link || undefined,
    payload: {
      kind: "notification-review-result",
      reviewRequestId: existing.id,
      reviewerUserId: reviewer.id,
      reviewedUserId: existing.reviewedUserId,
      status: input.status,
      resultComment: resultComment ?? undefined,
      ...(safeJson(existing.payloadJson)),
      ...(input.payload ?? {})
    }
  });

  return mapNotificationReviewRequest(updated);
}

export async function sendUserNotifications(input: SendUserNotificationInput): Promise<{ createdCount: number }> {
  const recipientUserIds = Array.from(new Set((input.recipientUserIds ?? []).map((id) => id.trim()).filter(Boolean)));
  const recipientOpenIds = Array.from(new Set((input.recipientOpenIds ?? []).map((id) => id.trim()).filter(Boolean)));

  if (!recipientUserIds.length && !recipientOpenIds.length) {
    throw new ServiceError("至少需要一个接收用户，支持 userId 或 open_id。", 400);
  }

  if (!input.title.trim()) {
    throw new ServiceError("通知标题不能为空。", 400);
  }

  if (!input.body.trim()) {
    throw new ServiceError("通知正文不能为空。", 400);
  }

  const [existingUsers, existingBindings] = await Promise.all([
    recipientUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: recipientUserIds } },
          select: { id: true }
        })
      : Promise.resolve([]),
    recipientOpenIds.length
      ? prisma.feishuAccountBinding.findMany({
          where: {
            openId: { in: recipientOpenIds },
            revokedAt: null
          },
          select: {
            openId: true,
            userId: true
          }
        })
      : Promise.resolve([])
  ]);

  const validRecipientUserIds = Array.from(
    new Set([
      ...existingUsers.map((user) => user.id),
      ...existingBindings.map((binding) => binding.userId)
    ])
  );

  if (!validRecipientUserIds.length) {
    throw new ServiceError("未找到有效的接收用户，请确认 open_id 或 userId 已绑定平台账号。", 404);
  }

  const result = await prisma.userNotification.createMany({
    data: validRecipientUserIds.map((recipientUserId) => ({
      recipientUserId,
      title: input.title.trim(),
      body: input.body.trim(),
      level: mapNotificationLevelToPrisma(input.level ?? "Medium"),
      source: input.source?.trim() || "system",
      link: input.link?.trim() || null,
      payloadJson: JSON.stringify(input.payload ?? {})
    }))
  });

  return { createdCount: result.count };
}

export async function markUserNotificationsRead(
  input: MarkUserNotificationsReadInput
): Promise<{ updatedCount: number }> {
  const notificationIds = Array.from(
    new Set((input.notificationIds ?? []).map((id) => id.trim()).filter(Boolean))
  );

  const result = await prisma.userNotification.updateMany({
    where: {
      recipientUserId: input.userId,
      readAt: null,
      source: {
        not: REVIEW_REQUEST_NOTIFICATION_SOURCE
      },
      ...(notificationIds.length ? { id: { in: notificationIds } } : {})
    },
    data: {
      readAt: new Date()
    }
  });

  return { updatedCount: result.count };
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function mapRiskLevel(level: string): NotificationLevel {
  switch (level) {
    case "LOW":
      return "Low";
    case "HIGH":
      return "High";
    default:
      return "Medium";
  }
}

function mapNotificationLevelToPrisma(level: NotificationLevel): "LOW" | "MEDIUM" | "HIGH" {
  switch (level) {
    case "Low":
      return "LOW";
    case "High":
      return "HIGH";
    default:
      return "MEDIUM";
  }
}

function buildNotificationReviewResultBody(reviewerName: string, status: "approved" | "rejected", resultComment?: string) {
  const prefix = status === "approved" ? `${reviewerName} 已完成审核，结果为通过。` : `${reviewerName} 已完成审核，结果为未通过。`;
  return resultComment ? `${prefix} 说明：${resultComment}` : prefix;
}

async function resolveSingleUserId(input: { userId?: string; openId?: string; label: string }) {
  const trimmedUserId = input.userId?.trim();
  const trimmedOpenId = input.openId?.trim();

  if (!trimmedUserId && !trimmedOpenId) {
    throw new ServiceError(`${input.label}不能为空。`, 400);
  }

  const [users, bindings] = await Promise.all([
    trimmedUserId
      ? prisma.user.findMany({
          where: { id: { in: [trimmedUserId] } },
          select: { id: true }
        })
      : Promise.resolve([]),
    trimmedOpenId
      ? prisma.feishuAccountBinding.findMany({
          where: {
            openId: { in: [trimmedOpenId] },
            revokedAt: null
          },
          select: {
            userId: true
          }
        })
      : Promise.resolve([])
  ]);

  const matchedUserIds = Array.from(new Set([...users.map((item) => item.id), ...bindings.map((item) => item.userId)]));
  if (!matchedUserIds.length) {
    throw new ServiceError(`未找到有效的${input.label}。`, 404);
  }

  return matchedUserIds[0];
}

function mapNotificationReviewRequest(row: {
  id: string;
  requesterUserId: string;
  reviewerUserId: string;
  reviewedUserId: string;
  title: string;
  body: string;
  link: string | null;
  payloadJson: string;
  status: string;
  resultComment: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationReviewRequest {
  return {
    id: row.id,
    requesterUserId: row.requesterUserId,
    reviewerUserId: row.reviewerUserId,
    reviewedUserId: row.reviewedUserId,
    title: row.title,
    body: row.body,
    link: row.link ?? undefined,
    payload: safeJson(row.payloadJson),
    status: mapNotificationReviewStatus(row.status),
    resultComment: row.resultComment ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapNotificationReviewStatus(status: string): NotificationReviewRequest["status"] {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    default:
      return "pending";
  }
}
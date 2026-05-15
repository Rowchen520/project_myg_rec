import { beforeEach, describe, expect, it, vi } from "vitest";

const robotMocks = vi.hoisted(() => ({
  sendNoticeCard: vi.fn()
}));

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findMany: vi.fn()
    },
    feishuAccountBinding: {
      findMany: vi.fn()
    },
    notificationReviewRequest: {
      count: vi.fn()
    },
    userNotification: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/feishu/robot", () => robotMocks);

describe("user notifications service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates notifications for valid recipients", async () => {
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "u-1" }]);
    mocks.prisma.feishuAccountBinding.findMany.mockResolvedValue([{ openId: "ou_2", userId: "u-2" }]);
    mocks.prisma.userNotification.createMany.mockResolvedValue({ count: 2 });

    const { sendUserNotifications } = await import("@/lib/services/user-notifications");
    const result = await sendUserNotifications({
      recipientUserIds: ["u-1", "u-1"],
      recipientOpenIds: ["ou_2", "ou_2"],
      title: "流程提醒",
      body: "请尽快处理待办。",
      level: "High",
      source: "workflow"
    });

    expect(result.createdCount).toBe(2);
    expect(mocks.prisma.userNotification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ recipientUserId: "u-1", source: "workflow", level: "HIGH" }),
          expect.objectContaining({ recipientUserId: "u-2", source: "workflow", level: "HIGH" })
        ])
      })
    );
  });

  it("lists notifications for a user ordered by latest first", async () => {
    mocks.prisma.userNotification.findMany.mockResolvedValue([
      {
        id: "n-1",
        recipientUserId: "u-1",
        recipient: {
          feishuBinding: {
            openId: "ou_1",
            revokedAt: null
          }
        },
        title: "风险提醒",
        body: "支付链路异常。",
        level: "HIGH",
        source: "system",
        link: "/projects/demo/overview",
        payloadJson: JSON.stringify({ projectId: "demo" }),
        readAt: null,
        createdAt: new Date("2026-05-15T09:00:00.000Z")
      }
    ]);

    const { listUserNotifications } = await import("@/lib/services/user-notifications");
    const notifications = await listUserNotifications("u-1", 10);

    expect(notifications).toEqual([
      expect.objectContaining({
        id: "n-1",
        recipientUserId: "u-1",
        recipientOpenId: "ou_1",
        title: "风险提醒",
        level: "High",
        source: "system",
        link: "/projects/demo/overview",
        payload: { projectId: "demo" }
      })
    ]);
  });

  it("filters pending review request messages out of inbox queries", async () => {
    mocks.prisma.userNotification.findMany.mockResolvedValue([
      {
        id: "n-review",
        recipientUserId: "u-1",
        recipient: {
          feishuBinding: {
            openId: "ou_1",
            revokedAt: null
          }
        },
        title: "请审核",
        body: "请处理审核。",
        level: "MEDIUM",
        source: "notification-review-request",
        link: "/notifications",
        payloadJson: JSON.stringify({ reviewRequestId: "nr-1" }),
        readAt: null,
        unreadReminderSentAt: null,
        createdAt: new Date("2026-05-15T09:00:00.000Z")
      },
      {
        id: "n-result",
        recipientUserId: "u-1",
        recipient: {
          feishuBinding: {
            openId: "ou_1",
            revokedAt: null
          }
        },
        title: "审核通过通知",
        body: "已通过。",
        level: "LOW",
        source: "notification-review-result",
        link: "/notifications",
        payloadJson: JSON.stringify({ reviewRequestId: "nr-1" }),
        readAt: null,
        unreadReminderSentAt: null,
        createdAt: new Date("2026-05-15T09:10:00.000Z")
      }
    ]);

    const { listInboxUserNotifications } = await import("@/lib/services/user-notifications");
    const notifications = await listInboxUserNotifications("u-1", 10);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.source).toBe("notification-review-result");
  });

  it("marks all unread notifications as read for the current user", async () => {
    mocks.prisma.userNotification.updateMany.mockResolvedValue({ count: 3 });

    const { markUserNotificationsRead } = await import("@/lib/services/user-notifications");
    const result = await markUserNotificationsRead({ userId: "u-1" });

    expect(result.updatedCount).toBe(3);
    expect(mocks.prisma.userNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientUserId: "u-1",
          readAt: null
        }),
        data: expect.objectContaining({
          readAt: expect.any(Date)
        })
      })
    );
  });

  it("does not mark pending review notifications as read during bulk mark-all-read", async () => {
    mocks.prisma.userNotification.updateMany.mockResolvedValue({ count: 1 });

    const { markUserNotificationsRead } = await import("@/lib/services/user-notifications");
    const result = await markUserNotificationsRead({ userId: "u-1" });

    expect(result.updatedCount).toBe(1);
    expect(mocks.prisma.userNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientUserId: "u-1",
          readAt: null,
          source: {
            not: "notification-review-request"
          }
        })
      })
    );
  });

  it("counts unread notifications without triggering overdue reminder side effects", async () => {
    mocks.prisma.userNotification.count.mockResolvedValue(2);
    mocks.prisma.notificationReviewRequest.count.mockResolvedValue(1);

    const { getUserNotificationSummary } = await import("@/lib/services/user-notifications");
    const summary = await getUserNotificationSummary("u-1");

    expect(summary).toEqual({ unreadCount: 3 });
    expect(mocks.prisma.userNotification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientUserId: "u-1",
          readAt: null,
          source: {
            not: "notification-review-request"
          }
        })
      })
    );
    expect(mocks.prisma.notificationReviewRequest.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reviewerUserId: "u-1",
          status: "PENDING"
        }
      })
    );
    expect(robotMocks.sendNoticeCard).not.toHaveBeenCalled();
    expect(mocks.prisma.userNotification.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.userNotification.updateMany).not.toHaveBeenCalled();
  });

  it("scans all users for overdue unread notifications in one scheduled run", async () => {
    mocks.prisma.userNotification.findMany.mockResolvedValue([
      {
        id: "n-1",
        recipientUserId: "u-1",
        recipient: {
          feishuBinding: {
            openId: "ou_1",
            revokedAt: null
          }
        }
      },
      {
        id: "n-2",
        recipientUserId: "u-1",
        recipient: {
          feishuBinding: {
            openId: "ou_1",
            revokedAt: null
          }
        }
      },
      {
        id: "n-3",
        recipientUserId: "u-2",
        recipient: {
          feishuBinding: {
            openId: "ou_2",
            revokedAt: null
          }
        }
      }
    ]);
    mocks.prisma.userNotification.updateMany.mockResolvedValue({ count: 2 });
    robotMocks.sendNoticeCard.mockResolvedValue({ ok: true });

    const { sendOverdueUnreadNotificationReminders } = await import("@/lib/services/user-notifications");
    const result = await sendOverdueUnreadNotificationReminders();

    expect(result).toEqual({
      scannedNotifications: 3,
      remindedNotifications: 3,
      notifiedUsers: 2,
      skippedUsers: 0
    });
    expect(robotMocks.sendNoticeCard).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.userNotification.updateMany).toHaveBeenCalledTimes(2);
  });
});
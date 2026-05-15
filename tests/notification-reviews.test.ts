import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findMany: vi.fn()
    },
    feishuAccountBinding: {
      findMany: vi.fn()
    },
    userNotification: {
      createMany: vi.fn(),
      updateMany: vi.fn()
    },
    notificationReviewRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/feishu/robot", () => ({ sendNoticeCard: vi.fn() }));

describe("notification review workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a review request and sends a review notification to reviewer A", async () => {
    mocks.prisma.user.findMany.mockImplementation(async (input?: { where?: { id?: { in?: string[] } } }) => {
      const ids = input?.where?.id?.in ?? [];
      return ids.map((id) => ({ id }));
    });
    mocks.prisma.feishuAccountBinding.findMany.mockResolvedValue([]);
    mocks.prisma.notificationReviewRequest.create.mockResolvedValue({
      id: "nr-1",
      requesterUserId: "u-requester",
      reviewerUserId: "u-reviewer",
      reviewedUserId: "u-reviewed",
      title: "请审核入场申请",
      body: "请确认该用户是否可以通过审核。",
      link: "/notifications",
      payloadJson: JSON.stringify({ ticketId: "t-1" }),
      status: "PENDING",
      resultComment: null,
      reviewedAt: null,
      createdAt: new Date("2026-05-15T10:00:00.000Z"),
      updatedAt: new Date("2026-05-15T10:00:00.000Z")
    });
    mocks.prisma.userNotification.createMany.mockResolvedValue({ count: 1 });

    const { createNotificationReviewRequest } = await import("@/lib/services/user-notifications");
    const reviewRequest = await createNotificationReviewRequest(
      {
        reviewerUserId: "u-reviewer",
        reviewedUserId: "u-reviewed",
        title: "请审核入场申请",
        body: "请确认该用户是否可以通过审核。",
        link: "/notifications",
        payload: { ticketId: "t-1" }
      },
      {
        id: "u-requester",
        name: "发起人",
        role: "admin",
        personId: "p-1",
        managedProjectIds: [],
        participatingProjectIds: []
      }
    );

    expect(reviewRequest.status).toBe("pending");
    expect(mocks.prisma.notificationReviewRequest.create).toHaveBeenCalled();
    expect(mocks.prisma.userNotification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            recipientUserId: "u-reviewer",
            title: "请审核入场申请",
            source: "notification-review-request"
          })
        ])
      })
    );
  });

  it("returns the review result to the reviewed user after reviewer A completes it", async () => {
    mocks.prisma.notificationReviewRequest.findUnique.mockResolvedValue({
      id: "nr-1",
      requesterUserId: "u-requester",
      reviewerUserId: "u-reviewer",
      reviewedUserId: "u-reviewed",
      title: "请审核入场申请",
      body: "请确认该用户是否可以通过审核。",
      link: "/notifications",
      payloadJson: JSON.stringify({ ticketId: "t-1" }),
      status: "PENDING",
      resultComment: null,
      reviewedAt: null,
      createdAt: new Date("2026-05-15T10:00:00.000Z"),
      updatedAt: new Date("2026-05-15T10:00:00.000Z")
    });
    mocks.prisma.notificationReviewRequest.update.mockResolvedValue({
      id: "nr-1",
      requesterUserId: "u-requester",
      reviewerUserId: "u-reviewer",
      reviewedUserId: "u-reviewed",
      title: "请审核入场申请",
      body: "请确认该用户是否可以通过审核。",
      link: "/notifications",
      payloadJson: JSON.stringify({ ticketId: "t-1" }),
      status: "APPROVED",
      resultComment: "资料完整，可以通过。",
      reviewedAt: new Date("2026-05-15T11:00:00.000Z"),
      createdAt: new Date("2026-05-15T10:00:00.000Z"),
      updatedAt: new Date("2026-05-15T11:00:00.000Z")
    });
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "u-reviewed" }]);
    mocks.prisma.feishuAccountBinding.findMany.mockResolvedValue([]);
    mocks.prisma.userNotification.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.userNotification.createMany.mockResolvedValue({ count: 1 });

    const { completeNotificationReviewRequest } = await import("@/lib/services/user-notifications");
    const reviewRequest = await completeNotificationReviewRequest(
      "nr-1",
      {
        status: "approved",
        resultComment: "资料完整，可以通过。"
      },
      {
        id: "u-reviewer",
        name: "审核人A",
        role: "admin",
        personId: "p-reviewer",
        managedProjectIds: [],
        participatingProjectIds: []
      }
    );

    expect(reviewRequest.status).toBe("approved");
    expect(mocks.prisma.userNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientUserId: "u-reviewer",
          source: "notification-review-request",
          readAt: null
        }),
        data: expect.objectContaining({
          readAt: expect.any(Date)
        })
      })
    );
    expect(mocks.prisma.userNotification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            recipientUserId: "u-reviewed",
            source: "notification-review-result",
            title: "审核通过通知"
          })
        ])
      })
    );
  });
});
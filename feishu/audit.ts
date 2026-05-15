import { prisma } from "@/lib/prisma";

type FeishuAuthAuditEvent =
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "PROFILE_COMPLETED"
  | "BINDING_REMOVED";

interface LogFeishuAuthEventInput {
  event: FeishuAuthAuditEvent;
  success: boolean;
  userId?: string;
  tenantKey?: string;
  openId?: string;
  unionId?: string;
  message?: string;
  redirectTo?: string;
}

export async function logFeishuAuthEvent(input: LogFeishuAuthEventInput) {
  await prisma.feishuAuthAuditLog.create({
    data: {
      event: input.event,
      success: input.success,
      userId: input.userId,
      tenantKey: input.tenantKey ?? "default",
      openId: input.openId,
      unionId: input.unionId,
      message: input.message,
      redirectTo: input.redirectTo
    }
  });
}

export async function listFeishuAuthAuditLogs(userId: string, take = 10) {
  return prisma.feishuAuthAuditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take
  });
}
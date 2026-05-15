import { prisma } from "@/lib/prisma";
import { getFeishuConfig } from "./config";
import { logFeishuAuthEvent, listFeishuAuthAuditLogs } from "./audit";

export async function getFeishuAccountOverview(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      person: true,
      feishuBinding: true
    }
  });

  const logs = await listFeishuAuthAuditLogs(userId, 10);
  return { user, logs };
}

export async function completeFeishuProfile(
  userId: string,
  input: { displayName: string; personRole: string; capacity: number }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { feishuBinding: true }
  });

  if (!user?.feishuBinding) {
    throw new Error("当前账号尚未绑定飞书身份。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: input.displayName,
        person: {
          update: {
            name: input.displayName,
            role: input.personRole,
            capacity: input.capacity
          }
        }
      }
    });

    await tx.feishuAccountBinding.update({
      where: { userId },
      data: {
        displayName: input.displayName,
        profileCompletedAt: new Date()
      }
    });
  });

  await logFeishuAuthEvent({
    event: "PROFILE_COMPLETED",
    success: true,
    userId,
    tenantKey: user.feishuBinding.tenantKey,
    openId: user.feishuBinding.openId,
    unionId: user.feishuBinding.unionId ?? undefined,
    message: "完成首次飞书资料补全。"
  });
}

export async function unlinkFeishuAccount(userId: string) {
  const binding = await prisma.feishuAccountBinding.findUnique({ where: { userId } });
  if (!binding) {
    return;
  }

  await prisma.feishuAccountBinding.update({
    where: { userId },
    data: {
      revokedAt: new Date()
    }
  });
  await logFeishuAuthEvent({
    event: "BINDING_REMOVED",
    success: true,
    userId,
    tenantKey: binding.tenantKey,
    openId: binding.openId,
    unionId: binding.unionId ?? undefined,
    message: "用户主动解除飞书绑定。"
  });
}

export function getTenantKey() {
  return getFeishuConfig().tenantKey;
}
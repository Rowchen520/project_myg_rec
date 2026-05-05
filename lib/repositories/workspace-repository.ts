import { prisma } from "@/lib/prisma";
import type { WorkspaceSnapshot } from "@/lib/types";
import {
  mapNotificationChannel,
  mapNotificationRule,
  mapPerson,
  mapProject,
  mapStewardMessage,
  mapUser,
  mapWorkPackage,
  mapWorkPackageApproval,
  mapWorkPackageComment,
  type StoredNotificationChannel,
  type StoredNotificationRule,
  type StoredPerson,
  type StoredProject,
  type StoredStewardMessage,
  type StoredUser,
  type StoredWorkPackage,
  type StoredWorkPackageApproval,
  type StoredWorkPackageComment
} from "./workspace-mappers";

export interface WorkspaceRepositoryOptions {
  userId?: string;
  projectId?: string;
}

type WorkPackageVisibilityWhere = {
  projectId?: string | null | { in: string[] };
  createdByUserId?: string;
  OR?: WorkPackageVisibilityWhere[];
};

/**
 * Reads a production workspace snapshot from Prisma and maps it to the UI DTO.
 * Honors the OpenProject visibility rules: admins see everything, other roles
 * are restricted to their project memberships.
 */
export async function getWorkspaceSnapshotFromRepository(
  options: WorkspaceRepositoryOptions = {}
): Promise<WorkspaceSnapshot> {
  const users = (await prisma.user.findMany({
    include: { memberships: true },
    orderBy: { createdAt: "asc" }
  })) as StoredUser[];
  const currentUser = options.userId
    ? users.find((user) => user.id === options.userId)
    : users[0];
  const visibleProjectIds = resolveVisibleProjectIds(users, currentUser, options.projectId);
  const workPackageWhere = resolveVisibleWorkPackageWhere(
    currentUser,
    visibleProjectIds,
    options.projectId
  );

  const [
    people,
    projects,
    workPackages,
    stewardMessages,
    workPackageComments,
    workPackageApprovals,
    notificationChannels,
    notificationRules
  ] = await Promise.all([
    prisma.person.findMany({ orderBy: { id: "asc" } }),
    prisma.project.findMany({
      where: visibleProjectIds ? { id: { in: visibleProjectIds } } : undefined,
      orderBy: { createdAt: "asc" }
    }),
    prisma.workPackage.findMany({
      where: workPackageWhere,
      orderBy: { id: "asc" }
    }),
    prisma.stewardMessage.findMany({
      where: visibleProjectIds
        ? { OR: [{ projectId: null }, { projectId: { in: visibleProjectIds } }] }
        : undefined,
      orderBy: { createdAt: "desc" }
    }),
    prisma.workPackageComment.findMany({
      where: workPackageWhere ? { workPackage: workPackageWhere } : undefined,
      orderBy: { createdAt: "desc" }
    }),
    prisma.workPackageApproval.findMany({
      where: workPackageWhere ? { workPackage: workPackageWhere } : undefined,
      orderBy: { createdAt: "desc" }
    }),
    prisma.notificationChannel.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.notificationRule.findMany({
      where: visibleProjectIds
        ? { OR: [{ projectId: null }, { projectId: { in: visibleProjectIds } }] }
        : undefined,
      include: { channels: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return {
    users: users.map(mapUser),
    people: (people as StoredPerson[]).map(mapPerson),
    projects: (projects as StoredProject[]).map(mapProject),
    workPackages: (workPackages as StoredWorkPackage[]).map(mapWorkPackage),
    workPackageComments: (workPackageComments as StoredWorkPackageComment[]).map(
      mapWorkPackageComment
    ),
    workPackageApprovals: (workPackageApprovals as StoredWorkPackageApproval[]).map(
      mapWorkPackageApproval
    ),
    stewardMessages: (stewardMessages as StoredStewardMessage[]).map(mapStewardMessage),
    notificationChannels: (notificationChannels as StoredNotificationChannel[]).map(
      mapNotificationChannel
    ),
    notificationRules: (notificationRules as StoredNotificationRule[]).map(mapNotificationRule)
  };
}

function resolveVisibleProjectIds(
  users: StoredUser[],
  currentUser: StoredUser | undefined,
  requestedProjectId: string | undefined
): string[] | undefined {
  if (!currentUser && !requestedProjectId) {
    return undefined;
  }

  if (!currentUser) {
    return requestedProjectId ? [requestedProjectId] : undefined;
  }

  const memberships = currentUser.memberships.map((membership) => membership.projectId);
  if (requestedProjectId) {
    return memberships.includes(requestedProjectId) ? [requestedProjectId] : [];
  }

  if (currentUser.role === "ADMIN") {
    return undefined;
  }

  return memberships;
}

function resolveVisibleWorkPackageWhere(
  currentUser: StoredUser | undefined,
  visibleProjectIds: string[] | undefined,
  requestedProjectId: string | undefined
): WorkPackageVisibilityWhere | undefined {
  if (!currentUser) {
    return visibleProjectIds ? { projectId: { in: visibleProjectIds } } : undefined;
  }

  if (requestedProjectId) {
    return { projectId: { in: visibleProjectIds ?? [] } };
  }

  if (currentUser.role === "ADMIN") {
    return undefined;
  }

  return {
    OR: [
      { projectId: { in: visibleProjectIds ?? [] } },
      { projectId: null, createdByUserId: currentUser.id }
    ]
  };
}

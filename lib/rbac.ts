import type { PlatformRole, RolePermission, User, WorkspaceSnapshot } from "./types";

export const roleLabels: Record<PlatformRole, string> = {
  admin: "管理员",
  projectManager: "项目经理",
  participant: "项目参与员"
};

export const permissionMatrix: RolePermission[] = [
  {
    key: "overview",
    label: "查看项目工作台",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "manageProjects",
    label: "创建与管理项目",
    admin: true,
    projectManager: true,
    participant: false
  },
  {
    key: "manageProjectModules",
    label: "启用/禁用项目模块",
    admin: true,
    projectManager: true,
    participant: false
  },
  {
    key: "assignWorkPackages",
    label: "分配工作项与调整负责人",
    admin: true,
    projectManager: true,
    participant: false
  },
  {
    key: "updateOwnWorkPackages",
    label: "更新本人工作项进展",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "approveWorkPackages",
    label: "对工作项执行签核",
    admin: true,
    projectManager: true,
    participant: false
  },
  {
    key: "manageNotifications",
    label: "管理通知通道与路由规则",
    admin: true,
    projectManager: true,
    participant: false
  },
  {
    key: "viewNotifications",
    label: "查看个人范围内的智能通知",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "viewIntelligence",
    label: "查看智能调度建议、健康度与催办",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "useAgentBreakdown",
    label: "使用 AI 拆解工作项草稿",
    admin: true,
    projectManager: true,
    participant: false
  },
  {
    key: "createPersonalWorkPackage",
    label: "创建个人工作项",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "deleteOwnWorkPackage",
    label: "删除本人创建的工作项",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "usePersonalAgentBreakdown",
    label: "使用个人 AI 拆解",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "deleteAnyWorkPackage",
    label: "删除任意工作项",
    admin: true,
    projectManager: false,
    participant: false
  },
  {
    key: "viewPlatformOverview",
    label: "查看平台总览",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "managePlatformFeatureFlags",
    label: "管理平台模块开关",
    admin: true,
    projectManager: false,
    participant: false
  },
  {
    key: "viewBigScreen",
    label: "查看平台大屏",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "useAgentTool",
    label: "使用 AI 工具",
    admin: true,
    projectManager: true,
    participant: true
  },
  {
    key: "manageAgentApiKeys",
    label: "管理 Agent API Key",
    admin: true,
    projectManager: false,
    participant: false
  },
  {
    key: "viewAgentAudit",
    label: "查看 Agent 调用审计",
    admin: true,
    projectManager: true,
    participant: false
  }
];

/**
 * Checks whether the role can use the given permission.
 */
export function can(role: PlatformRole, permissionKey: string): boolean {
  const permission = permissionMatrix.find((item) => item.key === permissionKey);
  return permission ? permission[role] : false;
}

/**
 * Filters workspace data according to the current user's project scope.
 */
export function filterWorkspaceForUser(snapshot: WorkspaceSnapshot, user: User): WorkspaceSnapshot {
  if (user.role === "admin") {
    return snapshot;
  }

  const visibleProjectIds = new Set([...user.managedProjectIds, ...user.participatingProjectIds]);
  const visibleWorkPackages = snapshot.workPackages.filter(
    (wp) =>
      (wp.projectId ? visibleProjectIds.has(wp.projectId) : wp.createdByUserId === user.id)
  );
  const scopedWorkPackages =
    user.role === "participant"
      ? visibleWorkPackages.filter(
          (wp) => wp.assigneeId === user.personId || wp.createdByUserId === user.id
        )
      : visibleWorkPackages;
  const visibleWorkPackageIds = new Set(scopedWorkPackages.map((wp) => wp.id));
  const visiblePeopleIds = new Set([
    ...visibleWorkPackages.map((wp) => wp.assigneeId).filter((id): id is string => Boolean(id)),
    user.personId
  ]);

  return {
    ...snapshot,
    projects: snapshot.projects.filter((project) => visibleProjectIds.has(project.id)),
    workPackages: scopedWorkPackages,
    people: snapshot.people.filter((person) => visiblePeopleIds.has(person.id)),
    workPackageComments: snapshot.workPackageComments.filter(
      (comment) =>
        visibleWorkPackageIds.has(comment.workPackageId) ||
        comment.authorPersonId === user.personId ||
        comment.mentionsPersonIds.includes(user.personId)
    ),
    workPackageApprovals: snapshot.workPackageApprovals.filter(
      (approval) =>
        visibleWorkPackageIds.has(approval.workPackageId) ||
        approval.reviewerPersonId === user.personId
    ),
    stewardMessages: snapshot.stewardMessages,
    notificationChannels: snapshot.notificationChannels.filter(
      (channel) =>
        channel.audienceRoles.includes(user.role) ||
        channel.audiencePersonIds.includes(user.personId)
    ),
    notificationRules:
      user.role === "participant"
        ? snapshot.notificationRules.filter((rule) => rule.audienceRoles.includes(user.role))
        : snapshot.notificationRules
  };
}

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db"
});
const prisma = new PrismaClient({ adapter });

const people = [
  { id: "p1", name: "产品负责人", role: "Product", capacity: 32, skills: ["产品定义", "用户故事", "验收口径"] },
  { id: "p2", name: "前端开发", role: "Frontend", capacity: 36, skills: ["看板设计", "前端实现", "图表可视化"] },
  { id: "p3", name: "后端开发", role: "Backend", capacity: 36, skills: ["接口设计", "数据建模", "Agent 编排"] },
  { id: "p4", name: "测试与部署", role: "QA/Ops", capacity: 28, skills: ["测试设计", "部署运维", "健康检查"] }
];

const projects = [
  {
    id: "proj-platform",
    identifier: "platform",
    name: "平台总览",
    description: "组合 AI 项目管理平台与其子项目的根项目，承载跨项目报表和成员管理。",
    parentId: null,
    status: "ACTIVE",
    health: "LOW",
    initialDifficulty: "LOW",
    progress: 35,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    enabledModules: ["overview", "members", "settings"]
  },
  {
    id: "proj-ai-pm",
    identifier: "ai-pm",
    name: "AI 项目管理平台",
    description: "通过对话、动态看板和 AI 管家完成项目任务管理、进度跟进与风险分析。",
    parentId: "proj-platform",
    status: "ACTIVE",
    health: "MEDIUM",
    initialDifficulty: "MEDIUM",
    progress: 42,
    startDate: "2026-01-05T00:00:00.000Z",
    endDate: "2026-06-30T00:00:00.000Z",
    enabledModules: [
      "overview",
      "work_packages",
      "boards",
      "gantt",
      "members",
      "ai_diagnosis",
      "ai_breakdown",
      "settings"
    ]
  },
  {
    id: "proj-ai-pm-mobile",
    identifier: "ai-pm-mobile",
    name: "移动端体验",
    description: "AI 项目管理平台的移动端体验子项目，复用平台核心数据。",
    parentId: "proj-ai-pm",
    status: "ON_HOLD",
    health: "LOW",
    initialDifficulty: "LOW",
    progress: 12,
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-09-30T00:00:00.000Z",
    enabledModules: ["overview", "work_packages", "boards", "members", "settings"]
  }
];

const users = [
  { id: "u-admin", name: "平台管理员", role: "ADMIN", personId: "p1", projectIds: projects.map((p) => p.id), leadProjectIds: projects.map((p) => p.id) },
  { id: "u-pm", name: "项目经理", role: "PROJECT_MANAGER", personId: "p1", projectIds: ["proj-ai-pm", "proj-ai-pm-mobile"], leadProjectIds: ["proj-ai-pm", "proj-ai-pm-mobile"] },
  { id: "u-member", name: "项目参与员", role: "PARTICIPANT", personId: "p2", projectIds: ["proj-ai-pm"], leadProjectIds: [] }
];

const workPackages = [
  {
    id: 1,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "MILESTONE",
    subject: "Agent OS 里程碑",
    description: "沉淀产品、需求、开发、测试、部署的无人值守流程基线。",
    assigneeId: "p1",
    startDate: "2026-04-20T00:00:00.000Z",
    status: "achieved",
    priority: "P0",
    percentComplete: 100,
    lastProgressNote: "Agent OS 已交付。",
    dependencies: [],
    requiredSkills: ["产品定义"],
    dueDate: "2026-04-26T00:00:00.000Z"
  },
  {
    id: 2,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "TASK",
    subject: "实现对话式任务拆解",
    description: "用户输入自然语言后，生成 WorkPackage 草稿和风险候选。",
    assigneeId: "p3",
    startDate: "2026-04-26T00:00:00.000Z",
    status: "inProgress",
    priority: "P0",
    estimateHours: 14,
    percentComplete: 65,
    lastProgressNote: "对话拆解可生成草稿，等待接入服务端权限范围。",
    dependencies: [1],
    requiredSkills: ["接口设计", "Agent 编排"],
    dueDate: "2026-05-05T00:00:00.000Z"
  },
  {
    id: 3,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "TASK",
    subject: "构建 OpenProject 风格工作项表格与详情面板",
    description: "Primer 风格的 split-screen 工作项视图：表格 + 右侧详情。",
    assigneeId: "p2",
    startDate: "2026-04-24T00:00:00.000Z",
    status: "review",
    priority: "P1",
    estimateHours: 18,
    percentComplete: 80,
    lastProgressNote: "表格与详情面板初版完成，等待 UI 复审。",
    dependencies: [2],
    requiredSkills: ["看板设计", "前端实现"],
    dueDate: "2026-04-30T00:00:00.000Z"
  },
  {
    id: 4,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "TASK",
    subject: "Docker 与 VPS 部署模板",
    description: "构建 Dockerfile、docker-compose、GitHub Actions 与健康检查。",
    assigneeId: "p4",
    startDate: "2026-04-27T00:00:00.000Z",
    status: "blocked",
    priority: "P1",
    estimateHours: 10,
    percentComplete: 25,
    lastProgressNote: "部署模板存在，等待 VPS 凭据。",
    dependencies: [2, 3],
    requiredSkills: ["部署运维", "健康检查"],
    dueDate: "2026-04-29T00:00:00.000Z"
  },
  {
    id: 5,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "RISK",
    subject: "部署凭据未配置",
    description: "无法完成真实 VPS 自动部署，只能交付部署模板。",
    assigneeId: "p4",
    startDate: "2026-04-25T00:00:00.000Z",
    status: "open",
    priority: "P1",
    percentComplete: 0,
    lastProgressNote: "等待运维提供 SSH key。",
    dependencies: [],
    requiredSkills: [],
    riskLevel: "MEDIUM",
    riskImpact: "无法完成真实 VPS 自动部署，只能交付部署模板。",
    riskMitigation: "使用 GitHub Secrets 占位，并在 README 中说明所需变量。"
  },
  {
    id: 6,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "RISK",
    subject: "真实 LLM Provider 未接入",
    description: "AI 分析暂由 Mock Provider 保障演示。",
    assigneeId: "p3",
    startDate: "2026-04-28T00:00:00.000Z",
    status: "mitigating",
    priority: "P2",
    percentComplete: 30,
    lastProgressNote: "OpenAI Provider 接口已就绪，待接入 API Key。",
    dependencies: [],
    requiredSkills: [],
    riskLevel: "LOW",
    riskImpact: "AI 分析暂由 Mock Provider 保障演示。",
    riskMitigation: "保留 OpenAI 兼容 Provider 接口，后续配置 API Key 即可启用。"
  },
  {
    id: 7,
    projectId: "proj-ai-pm-mobile",
    type: "TASK",
    subject: "移动端工作项列表",
    description: "为移动端实现 OpenProject 风格的工作项列表视图。",
    assigneeId: "p2",
    startDate: "2026-05-20T00:00:00.000Z",
    status: "todo",
    priority: "P2",
    estimateHours: 12,
    percentComplete: 0,
    lastProgressNote: "等待移动端原型设计。",
    dependencies: [3],
    requiredSkills: ["前端实现"],
    dueDate: "2026-06-01T00:00:00.000Z"
  },
  {
    id: 8,
    projectId: null,
    createdByUserId: "u-member",
    origin: "SELF",
    type: "TASK",
    subject: "整理个人本周待办",
    description: "不绑定项目的个人事项，用于验证我的工作台可见性。",
    assigneeId: "p2",
    status: "todo",
    priority: "P2",
    estimateHours: 2,
    percentComplete: 0,
    lastProgressNote: "等待开始。",
    dependencies: [],
    requiredSkills: ["个人计划"],
    dueDate: "2026-05-03T00:00:00.000Z"
  },
  {
    id: 9,
    projectId: "proj-ai-pm",
    type: "PHASE",
    subject: "Phase 1 核心能力闭环",
    description: "关键问题：需求稳定性、核心页面验收、测试覆盖。",
    assigneeId: "p1",
    status: "active",
    priority: "P0",
    estimateHours: 40,
    percentComplete: 62,
    lastProgressNote: "首屏、个人工作台、总览基础已进入联调。",
    dependencies: [1],
    requiredSkills: ["产品定义", "接口设计"],
    startDate: "2026-04-20T00:00:00.000Z",
    dueDate: "2026-05-15T00:00:00.000Z"
  },
  {
    id: 10,
    projectId: "proj-ai-pm",
    parentId: 9,
    type: "MILESTONE",
    subject: "M2 平台总览验收",
    description: "平台总览与启动页进入演示验收。",
    assigneeId: "p1",
    status: "planned",
    priority: "P0",
    estimateHours: 4,
    percentComplete: 0,
    lastProgressNote: "等待 UI 验收。",
    dependencies: [2, 3, 9],
    requiredSkills: ["验收口径"],
    startDate: "2026-05-10T00:00:00.000Z",
    dueDate: "2026-05-15T00:00:00.000Z"
  },
  {
    id: 11,
    projectId: "proj-ai-pm",
    type: "PHASE",
    subject: "Phase 2 AI 工具与大屏治理",
    description: "关键问题：权限收敛、审计闭环、大屏投屏稳定性。",
    assigneeId: "p1",
    status: "planned",
    priority: "P0",
    estimateHours: 48,
    percentComplete: 35,
    lastProgressNote: "Agent Tools 与大屏展示进入集成验证。",
    dependencies: [9, 10],
    requiredSkills: ["Agent 编排", "可视化"],
    startDate: "2026-05-16T00:00:00.000Z",
    dueDate: "2026-06-12T00:00:00.000Z"
  },
  {
    id: 12,
    projectId: "proj-ai-pm",
    parentId: 11,
    type: "TASK",
    subject: "统一 Tool Registry 调用管道",
    description: "内部 SDK 与 REST 共用统一 schema、权限、审计与幂等逻辑。",
    assigneeId: "p3",
    status: "inProgress",
    priority: "P0",
    estimateHours: 18,
    percentComplete: 55,
    lastProgressNote: "核心注册表已完成，继续补齐审计视图。",
    dependencies: [10],
    requiredSkills: ["Agent 编排", "权限设计"],
    startDate: "2026-05-16T00:00:00.000Z",
    dueDate: "2026-05-28T00:00:00.000Z"
  },
  {
    id: 13,
    projectId: "proj-ai-pm",
    parentId: 11,
    type: "TASK",
    subject: "大屏看板投屏优化",
    description: "适配 1920×1080 / 4K，完成自动刷新、全屏入口和关键路径展示。",
    assigneeId: "p2",
    status: "todo",
    priority: "P1",
    estimateHours: 16,
    percentComplete: 20,
    lastProgressNote: "正在重构按日期驱动的甘特布局。",
    dependencies: [10],
    requiredSkills: ["前端实现", "可视化"],
    startDate: "2026-05-24T00:00:00.000Z",
    dueDate: "2026-06-08T00:00:00.000Z"
  },
  {
    id: 14,
    projectId: "proj-ai-pm",
    parentId: 11,
    type: "MILESTONE",
    subject: "M3 Agent Tools 与大屏验收",
    description: "AI 工具管道和展示型大屏完成演示验收。",
    assigneeId: "p1",
    status: "planned",
    priority: "P0",
    estimateHours: 4,
    percentComplete: 0,
    lastProgressNote: "等待 Phase 2 任务完成。",
    dependencies: [12, 13],
    requiredSkills: ["验收口径"],
    startDate: "2026-06-12T00:00:00.000Z",
    dueDate: "2026-06-12T00:00:00.000Z"
  },
  {
    id: 15,
    projectId: "proj-ai-pm",
    type: "PHASE",
    subject: "Phase 3 投产准备与治理",
    description: "关键问题：部署健康检查、生产权限、风险复盘。",
    assigneeId: "p1",
    status: "planned",
    priority: "P1",
    estimateHours: 36,
    percentComplete: 10,
    lastProgressNote: "等待 Phase 2 验收后启动。",
    dependencies: [14],
    requiredSkills: ["部署运维", "治理"],
    startDate: "2026-06-13T00:00:00.000Z",
    dueDate: "2026-06-30T00:00:00.000Z"
  },
  {
    id: 16,
    projectId: "proj-ai-pm",
    parentId: 15,
    type: "TASK",
    subject: "生产部署健康检查",
    description: "完善 Docker、健康检查、回滚说明和上线验收脚本。",
    assigneeId: "p4",
    status: "todo",
    priority: "P1",
    estimateHours: 14,
    percentComplete: 0,
    lastProgressNote: "等待 Agent Tools 验收后开始。",
    dependencies: [14],
    requiredSkills: ["部署运维", "健康检查"],
    startDate: "2026-06-13T00:00:00.000Z",
    dueDate: "2026-06-24T00:00:00.000Z"
  },
  {
    id: 17,
    projectId: "proj-ai-pm",
    parentId: 15,
    type: "TASK",
    subject: "管理员审计与权限复盘",
    description: "检查 API Key、Agent 调用、FeatureFlag 与管理员入口权限。",
    assigneeId: "p1",
    status: "todo",
    priority: "P1",
    estimateHours: 10,
    percentComplete: 0,
    lastProgressNote: "等待投产前统一复核。",
    dependencies: [14],
    requiredSkills: ["权限设计", "审计"],
    startDate: "2026-06-20T00:00:00.000Z",
    dueDate: "2026-06-28T00:00:00.000Z"
  },
  {
    id: 18,
    projectId: "proj-ai-pm",
    parentId: 15,
    type: "MILESTONE",
    subject: "M4 投产准备完成",
    description: "投产健康检查、权限复盘和风险闭环完成。",
    assigneeId: "p1",
    status: "planned",
    priority: "P1",
    estimateHours: 4,
    percentComplete: 0,
    lastProgressNote: "等待 Phase 3 完成。",
    dependencies: [16, 17],
    requiredSkills: ["验收口径"],
    startDate: "2026-06-30T00:00:00.000Z",
    dueDate: "2026-06-30T00:00:00.000Z"
  }
];

const workPackageComments = [
  {
    id: "wpc-1",
    workPackageId: 2,
    authorPersonId: "p3",
    type: "EVIDENCE",
    body: "已完成对话拆解 Mock Provider，下一步需要产品确认真实 LLM 输出字段。",
    mentionsPersonIds: ["p1"],
    source: "PLATFORM",
    createdAt: "2026-04-28T13:00:00.000Z"
  },
  {
    id: "wpc-2",
    workPackageId: 3,
    authorPersonId: "p2",
    type: "DECISION",
    body: "采用 OpenProject 风格的 split-screen 工作项布局，左表右详情。",
    mentionsPersonIds: ["p1"],
    source: "PLATFORM",
    createdAt: "2026-04-28T14:00:00.000Z"
  },
  {
    id: "wpc-3",
    workPackageId: 4,
    authorPersonId: "p4",
    type: "BLOCKER",
    body: "VPS SSH 与 GitHub Secrets 尚未配置，部署只能停留在模板验证。",
    mentionsPersonIds: ["p1", "p3"],
    source: "PLATFORM",
    createdAt: "2026-04-28T15:00:00.000Z"
  },
  {
    id: "wpc-im-1",
    workPackageId: 3,
    authorPersonId: "p2",
    type: "EVIDENCE",
    body: "【飞书回流】#3 已补充表格筛选截图和 hover 效果说明，等待设计复核。",
    mentionsPersonIds: ["p1"],
    source: "FEISHU",
    sourceChannelId: "ch-feishu-core",
    externalMessageId: "om_demo_wp3_001",
    externalThreadId: "thread_wp_review",
    authorDisplayName: "前端开发",
    createdAt: "2026-04-28T18:00:00.000Z"
  }
];

const workPackageApprovals = [
  {
    id: "wpa-1",
    workPackageId: 1,
    reviewerPersonId: "p1",
    status: "APPROVED",
    comment: "Agent OS 里程碑已达成，可关闭。",
    createdAt: "2026-04-28T16:00:00.000Z"
  },
  {
    id: "wpa-2",
    workPackageId: 3,
    reviewerPersonId: "p1",
    status: "PENDING",
    comment: "等待 UI 设计审查后签核。",
    createdAt: "2026-04-28T16:30:00.000Z"
  },
  {
    id: "wpa-3",
    workPackageId: 4,
    reviewerPersonId: "p1",
    status: "CHANGES_REQUESTED",
    comment: "需要补充部署凭据和回滚说明后再批准。",
    createdAt: "2026-04-28T17:00:00.000Z"
  }
];

const notificationChannels = [
  {
    id: "ch-feishu-core",
    name: "项目飞书群（核心）",
    type: "FEISHU",
    target: "https://open.feishu.cn/open-apis/bot/v2/hook/demo-token",
    enabled: true,
    audienceRoles: ["admin", "projectManager", "participant"],
    audiencePersonIds: [],
    note: "AI 管家进展、计划提醒推送到此群"
  },
  {
    id: "ch-wecom-risk",
    name: "风险企业微信群",
    type: "WECOM_BOT",
    target: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=demo-key",
    enabled: true,
    audienceRoles: ["admin", "projectManager"],
    audiencePersonIds: [],
    note: "中等以上风险预警，仅项目经理与管理员可见"
  }
];

const notificationRules = [
  {
    id: "rule-progress-feishu",
    projectId: "proj-ai-pm",
    name: "项目进展同步",
    eventTypes: ["progress", "planning"],
    minLevel: "LOW",
    audienceRoles: ["admin", "projectManager", "participant"],
    channelIds: ["ch-feishu-core"]
  },
  {
    id: "rule-risk-broadcast",
    projectId: "proj-ai-pm",
    name: "风险预警广播",
    eventTypes: ["risk"],
    minLevel: "MEDIUM",
    audienceRoles: ["admin", "projectManager"],
    channelIds: ["ch-feishu-core", "ch-wecom-risk"]
  }
];

const stewardMessages = [
  {
    id: "sm1",
    projectId: "proj-ai-pm",
    type: "progress",
    title: "今日进展",
    body: "AI 项目管理平台已切换到 OpenProject 风格架构，工作项与项目层级开始联动。",
    level: "LOW",
    createdAt: "2026-04-28T09:00:00.000Z"
  },
  {
    id: "sm2",
    projectId: "proj-ai-pm",
    type: "risk",
    title: "部署风险",
    body: "VPS 地址和 SSH 密钥尚未配置，真实自动部署会在 CI 模板完成后等待凭据。",
    level: "MEDIUM",
    createdAt: "2026-04-28T10:00:00.000Z"
  }
];

const platformFeatureFlags = [
  {
    key: "launchPage",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制项目启动选择页 /launch 与根路由启动流程。"
  },
  {
    key: "platformOverview",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制平台总览 /overview 入口、页面与 API。"
  },
  {
    key: "personalWorkPackage",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制个人事项快速新建与完整新建入口。"
  },
  {
    key: "personalAgentBreakdown",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制个人 AI 拆解 /my/breakdown 入口。"
  },
  {
    key: "personalNotifications",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制我的工作台个人通知区块。"
  },
  {
    key: "bigScreen",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制平台总览大屏看板 /overview/screen。"
  },
  {
    key: "agentTools",
    siteEnabled: true,
    roleOverrides: {},
    description: "控制 AI 友好工具集 REST / SDK 调用管道。"
  },
  {
    key: "agentMcpServer",
    siteEnabled: false,
    roleOverrides: {},
    description: "控制 MCP 预留端点；本阶段仅保留 501 壳子。"
  }
];

async function main() {
  await prisma.agentToolInvocation.deleteMany();
  await prisma.agentApiKey.deleteMany();
  await prisma.projectQualityMetric.deleteMany();
  await prisma.projectQualitySnapshot.deleteMany();
  await prisma.notificationDelivery.deleteMany();
  await prisma.notificationRuleChannel.deleteMany();
  await prisma.notificationRule.deleteMany();
  await prisma.notificationChannel.deleteMany();
  await prisma.agentBreakdownDraft.deleteMany();
  await prisma.workPackageApproval.deleteMany();
  await prisma.workPackageComment.deleteMany();
  await prisma.stewardMessage.deleteMany();
  await prisma.workPackage.deleteMany();
  await prisma.projectMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.project.deleteMany();
  await prisma.person.deleteMany();
  await prisma.platformFeatureFlag.deleteMany();

  await prisma.person.createMany({
    data: people.map((person) => ({
      ...person,
      skills: JSON.stringify(person.skills)
    }))
  });

  for (const project of projects) {
    await prisma.project.create({
      data: {
        id: project.id,
        identifier: project.identifier,
        name: project.name,
        description: project.description,
        parentId: project.parentId,
        status: project.status,
        health: project.health,
        initialDifficulty: project.initialDifficulty,
        progress: project.progress,
        startDate: project.startDate ? new Date(project.startDate) : null,
        endDate: project.endDate ? new Date(project.endDate) : null,
        enabledModules: JSON.stringify(project.enabledModules)
      }
    });
  }

  await prisma.user.createMany({
    data: users.map(({ id, name, role, personId }) => ({ id, name, role, personId }))
  });

  for (const user of users) {
    for (const projectId of user.projectIds) {
      await prisma.projectMembership.create({
        data: {
          userId: user.id,
          projectId,
          isLead: user.leadProjectIds.includes(projectId)
        }
      });
    }
  }

  for (const workPackage of workPackages) {
    await prisma.workPackage.create({
      data: {
        id: workPackage.id,
        projectId: workPackage.projectId,
        type: workPackage.type,
        subject: workPackage.subject,
        description: workPackage.description,
        status: workPackage.status,
        priority: workPackage.priority,
        origin: workPackage.origin ?? "MANAGER",
        createdByUserId: workPackage.createdByUserId ?? resolveProjectCreatorUserId(workPackage.projectId),
        assigneeId: workPackage.assigneeId,
        parentId: workPackage.parentId,
        startDate: workPackage.startDate ? new Date(workPackage.startDate) : null,
        estimateHours: workPackage.estimateHours,
        percentComplete: workPackage.percentComplete,
        lastProgressNote: workPackage.lastProgressNote,
        dependencies: JSON.stringify(workPackage.dependencies),
        requiredSkills: JSON.stringify(workPackage.requiredSkills),
        isOnCriticalPath: workPackage.priority === "P0",
        riskLevel: workPackage.riskLevel,
        riskImpact: workPackage.riskImpact,
        riskMitigation: workPackage.riskMitigation,
        dueDate: workPackage.dueDate ? new Date(workPackage.dueDate) : null
      }
    });
  }

  await prisma.workPackageComment.createMany({
    data: workPackageComments.map((comment) => ({
      id: comment.id,
      workPackageId: comment.workPackageId,
      authorPersonId: comment.authorPersonId,
      type: comment.type,
      body: comment.body,
      mentionsPersonIds: JSON.stringify(comment.mentionsPersonIds),
      source: comment.source,
      sourceChannelId: comment.sourceChannelId ?? null,
      externalMessageId: comment.externalMessageId ?? null,
      externalThreadId: comment.externalThreadId ?? null,
      authorDisplayName: comment.authorDisplayName ?? null,
      createdAt: new Date(comment.createdAt)
    }))
  });

  await prisma.workPackageApproval.createMany({
    data: workPackageApprovals.map((approval) => ({
      ...approval,
      createdAt: new Date(approval.createdAt)
    }))
  });

  await prisma.stewardMessage.createMany({
    data: stewardMessages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt)
    }))
  });

  await prisma.notificationChannel.createMany({
    data: notificationChannels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      target: channel.target,
      enabled: channel.enabled,
      audienceRoles: JSON.stringify(channel.audienceRoles),
      audiencePersonIds: JSON.stringify(channel.audiencePersonIds),
      note: channel.note
    }))
  });

  for (const rule of notificationRules) {
    await prisma.notificationRule.create({
      data: {
        id: rule.id,
        projectId: rule.projectId,
        name: rule.name,
        eventTypes: JSON.stringify(rule.eventTypes),
        minLevel: rule.minLevel,
        audienceRoles: JSON.stringify(rule.audienceRoles),
        channels: {
          create: rule.channelIds.map((channelId) => ({ channelId }))
        }
      }
    });
  }

  await prisma.agentBreakdownDraft.create({
    data: {
      id: "draft-mvp-main-path",
      projectId: "proj-ai-pm",
      createdByUserId: "u-pm",
      prompt: "将平台收束为生产可用的 AI 项目管理 MVP",
      analysisJson: JSON.stringify({
        productDefinition: "围绕项目经理日常同步建立可追溯闭环。",
        tasks: [],
        risks: [],
        progressReport: "待确认后生成正式工作项。",
        nextActions: ["确认 P0 主路径", "落地服务端事实源"]
      }),
      status: "PENDING"
    }
  });

  await prisma.platformFeatureFlag.createMany({
    data: platformFeatureFlags.map((flag) => ({
      ...flag,
      roleOverrides: JSON.stringify(flag.roleOverrides)
    }))
  });
}

function resolveProjectCreatorUserId(projectId) {
  const projectManager = users.find(
    (user) => user.role === "PROJECT_MANAGER" && user.projectIds.includes(projectId)
  );

  return projectManager?.id ?? "u-admin";
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

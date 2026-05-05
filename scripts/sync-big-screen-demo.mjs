import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db"
  })
});

const BASE_WORK_PACKAGE = {
  projectId: "proj-ai-pm",
  createdByUserId: "u-pm",
  origin: "MANAGER",
  assigneeId: "p1",
  priority: "P0",
  status: "planned",
  estimateHours: 4,
  percentComplete: 0,
  lastProgressNote: "",
  dependencies: [],
  requiredSkills: [],
  isOnCriticalPath: false
};

const bigScreenRows = [
  {
    id: 9,
    type: "PHASE",
    subject: "Phase 1 核心能力闭环",
    description: "关键问题：需求稳定性、核心页面验收、测试覆盖。",
    status: "active",
    estimateHours: 40,
    percentComplete: 62,
    lastProgressNote: "首屏、个人工作台、总览基础已进入联调。",
    dependencies: [1],
    requiredSkills: ["产品定义", "接口设计"],
    isOnCriticalPath: true,
    startDate: "2026-04-20T00:00:00.000Z",
    dueDate: "2026-05-15T00:00:00.000Z"
  },
  {
    id: 11,
    type: "PHASE",
    subject: "Phase 2 AI 工具与大屏治理",
    description: "关键问题：权限收敛、审计闭环、大屏投屏稳定性。",
    estimateHours: 48,
    percentComplete: 35,
    lastProgressNote: "Agent Tools 与大屏展示进入集成验证。",
    dependencies: [9, 10],
    requiredSkills: ["Agent 编排", "可视化"],
    isOnCriticalPath: true,
    startDate: "2026-05-16T00:00:00.000Z",
    dueDate: "2026-06-12T00:00:00.000Z"
  },
  {
    id: 15,
    type: "PHASE",
    subject: "Phase 3 投产准备与治理",
    description: "关键问题：部署健康检查、生产权限、风险复盘。",
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
    id: 10,
    parentId: 9,
    type: "MILESTONE",
    subject: "M2 平台总览验收",
    description: "平台总览与启动页进入演示验收。",
    dependencies: [2, 3, 9],
    requiredSkills: ["验收口径"],
    isOnCriticalPath: true,
    startDate: "2026-05-10T00:00:00.000Z",
    dueDate: "2026-05-15T00:00:00.000Z"
  },
  {
    id: 12,
    parentId: 11,
    type: "TASK",
    subject: "统一 Tool Registry 调用管道",
    description: "内部 SDK 与 REST 共用统一 schema、权限、审计与幂等逻辑。",
    assigneeId: "p3",
    status: "inProgress",
    estimateHours: 18,
    percentComplete: 55,
    lastProgressNote: "核心注册表已完成，继续补齐审计视图。",
    dependencies: [10],
    requiredSkills: ["Agent 编排", "权限设计"],
    isOnCriticalPath: true,
    startDate: "2026-05-16T00:00:00.000Z",
    dueDate: "2026-05-28T00:00:00.000Z"
  },
  {
    id: 13,
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
    parentId: 11,
    type: "MILESTONE",
    subject: "M3 Agent Tools 与大屏验收",
    description: "AI 工具管道和展示型大屏完成演示验收。",
    dependencies: [12, 13],
    requiredSkills: ["验收口径"],
    isOnCriticalPath: true,
    startDate: "2026-06-12T00:00:00.000Z",
    dueDate: "2026-06-12T00:00:00.000Z"
  },
  {
    id: 16,
    parentId: 15,
    type: "TASK",
    subject: "生产部署健康检查",
    description: "完善 Docker、健康检查、回滚说明和上线验收脚本。",
    assigneeId: "p4",
    status: "todo",
    priority: "P1",
    estimateHours: 14,
    lastProgressNote: "等待 Agent Tools 验收后开始。",
    dependencies: [14],
    requiredSkills: ["部署运维", "健康检查"],
    startDate: "2026-06-13T00:00:00.000Z",
    dueDate: "2026-06-24T00:00:00.000Z"
  },
  {
    id: 17,
    parentId: 15,
    type: "TASK",
    subject: "管理员审计与权限复盘",
    description: "检查 API Key、Agent 调用、FeatureFlag 与管理员入口权限。",
    status: "todo",
    priority: "P1",
    estimateHours: 10,
    lastProgressNote: "等待投产前统一复核。",
    dependencies: [14],
    requiredSkills: ["权限设计", "审计"],
    startDate: "2026-06-20T00:00:00.000Z",
    dueDate: "2026-06-28T00:00:00.000Z"
  },
  {
    id: 18,
    parentId: 15,
    type: "MILESTONE",
    subject: "M4 投产准备完成",
    description: "投产健康检查、权限复盘和风险闭环完成。",
    status: "planned",
    priority: "P1",
    dependencies: [16, 17],
    requiredSkills: ["验收口径"],
    startDate: "2026-06-30T00:00:00.000Z",
    dueDate: "2026-06-30T00:00:00.000Z"
  }
];

/**
 * Converts one demo row into the Prisma shape used by the current schema.
 */
function toWorkPackageData(row) {
  const merged = { ...BASE_WORK_PACKAGE, ...row };

  return {
    id: merged.id,
    projectId: merged.projectId,
    type: merged.type,
    subject: merged.subject,
    description: merged.description,
    status: merged.status,
    priority: merged.priority,
    origin: merged.origin,
    createdByUserId: merged.createdByUserId,
    assigneeId: merged.assigneeId,
    parentId: merged.parentId ?? null,
    startDate: new Date(merged.startDate),
    dueDate: new Date(merged.dueDate),
    estimateHours: merged.estimateHours,
    percentComplete: merged.percentComplete,
    lastProgressNote: merged.lastProgressNote,
    dependencies: JSON.stringify(merged.dependencies),
    requiredSkills: JSON.stringify(merged.requiredSkills),
    isOnCriticalPath: merged.isOnCriticalPath,
    riskLevel: merged.riskLevel ?? null,
    riskImpact: merged.riskImpact ?? null,
    riskMitigation: merged.riskMitigation ?? null
  };
}

async function upsertBigScreenRow(row) {
  const value = toWorkPackageData(row);
  const { id, ...update } = value;

  await prisma.workPackage.upsert({
    where: { id },
    update,
    create: value
  });
}

async function main() {
  for (const row of bigScreenRows) {
    await upsertBigScreenRow(row);
  }

  await prisma.workPackage.updateMany({
    where: {
      id: { in: [1, 2, 3, 4, 5, 6] },
      projectId: "proj-ai-pm"
    },
    data: { parentId: 9 }
  });

  const counts = await prisma.workPackage.groupBy({
    by: ["type"],
    where: { projectId: "proj-ai-pm" },
    _count: { _all: true }
  });

  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredWorkPackage } from "@/lib/repositories/workspace-mappers";
import type { AgentAnalysis, User } from "@/lib/types";

const mocks = vi.hoisted(() => {
  const tx = {
    workPackage: { create: vi.fn() },
    agentBreakdownDraft: { update: vi.fn() }
  };

  return {
    prisma: {
      workPackage: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      workPackageProgressEvent: {
        create: vi.fn()
      },
      agentBreakdownDraft: {
        create: vi.fn(),
        findUnique: vi.fn()
      },
      person: { findMany: vi.fn() },
      $transaction: vi.fn()
    },
    tx,
    analyzeWithProvider: vi.fn()
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/agent/provider", () => ({ analyzeWithProvider: mocks.analyzeWithProvider }));

const participant: User = {
  id: "u-member",
  name: "项目参与员",
  role: "participant",
  personId: "p2",
  managedProjectIds: [],
  participatingProjectIds: ["proj-ai-pm"]
};

const personalAnalysis: AgentAnalysis = {
  productDefinition: "个人事项拆解",
  tasks: [
    {
      title: "整理个人待办",
      description: "把本周事项拆成可执行清单",
      priority: "P1",
      assigneeRole: "Frontend",
      milestone: "个人计划",
      type: "task"
    }
  ],
  risks: [
    {
      title: "时间被会议打断",
      level: "Low",
      impact: "个人事项可能延期",
      mitigation: "预留专注时段"
    }
  ],
  progressReport: "已拆解",
  nextActions: ["确认写入"]
};

type WorkPackageCreateMockArgs = {
  data: Partial<StoredWorkPackage> & {
    status?: string;
    priority?: string;
    riskLevel?: string | null;
    riskImpact?: string | null;
    riskMitigation?: string | null;
  };
};

type DraftCreateMockArgs = {
  data: Record<string, unknown>;
};

describe("personal work package foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof mocks.tx) => unknown) => callback(mocks.tx)
    );
    mocks.prisma.person.findMany.mockResolvedValue([]);
    mocks.analyzeWithProvider.mockResolvedValue(personalAnalysis);
  });

  it("creates personal work packages with creator and SELF origin", async () => {
    const { createWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.create.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        ...data,
        id: 9,
        projectId: null,
        type: "TASK",
        status: "todo",
        priority: "P1",
        percentComplete: 0,
        riskLevel: null,
        riskImpact: null,
        riskMitigation: null
      })
    );

    const workPackage = await createWorkPackage(
      { projectId: null, type: "task", subject: "记录个人事项" },
      participant
    );

    expect(mocks.prisma.workPackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: null,
          origin: "SELF",
          createdByUserId: "u-member",
          assigneeId: "p2"
        })
      })
    );
    expect(workPackage.projectId).toBeUndefined();
    expect(workPackage.origin).toBe("self");
  });

  it("allows creators to delete personal work packages", async () => {
    const { deleteWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 8,
        projectId: null,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: "p2"
      })
    );

    await expect(deleteWorkPackage(8, participant)).resolves.toMatchObject({
      id: 8,
      origin: "self",
      createdByUserId: "u-member"
    });
    expect(mocks.prisma.workPackage.delete).toHaveBeenCalledWith({ where: { id: 8 } });
  });

  it("blocks assignees from deleting manager-created work packages", async () => {
    const { deleteWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 3,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2"
      })
    );

    await expect(deleteWorkPackage(3, participant)).rejects.toMatchObject({
      status: 403
    });
    expect(mocks.prisma.workPackage.delete).not.toHaveBeenCalled();
  });

  it("lets creators attach personal work packages to visible projects", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 8,
        projectId: null,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: "p2"
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 8,
        projectId: data.projectId as string,
        origin: "SELF",
        createdByUserId: "u-member",
        assigneeId: "p2"
      })
    );

    await expect(updateWorkPackage(8, { projectId: "proj-ai-pm" }, participant)).resolves.toMatchObject({
      projectId: "proj-ai-pm",
      createdByUserId: "u-member"
    });
    expect(mocks.prisma.workPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: "proj-ai-pm" })
      })
    );
  });

  it("records a progress event when an assignee updates task progress", async () => {
    const { updateWorkPackage } = await import("@/lib/services/work-package-workflow");
    mocks.prisma.workPackage.findUnique.mockResolvedValue(
      storedWorkPackage({
        id: 3,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2",
        percentComplete: 20
      })
    );
    mocks.prisma.workPackage.update.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        id: 3,
        projectId: "proj-ai-pm",
        origin: "MANAGER",
        createdByUserId: "u-pm",
        assigneeId: "p2",
        percentComplete: data.percentComplete as number,
        status: data.status
      })
    );

    await updateWorkPackage(3, { percentComplete: 70, lastProgressNote: "推进到联调" }, participant);

    expect(mocks.prisma.workPackageProgressEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workPackageId: 3,
          eventType: "PROGRESS_UPDATED",
          userId: "u-member",
          reason: "推进到联调"
        })
      })
    );
  });

  it("stores personal AI drafts with nullable project id", async () => {
    const { createAgentBreakdownDraft } = await import("@/lib/services/agent-breakdown");
    mocks.prisma.agentBreakdownDraft.create.mockImplementation(async ({ data }: DraftCreateMockArgs) => ({
      id: "draft-personal",
      ...data
    }));

    const result = await createAgentBreakdownDraft("帮我拆解个人待办", null, participant);

    expect(result.draftId).toBe("draft-personal");
    expect(mocks.prisma.agentBreakdownDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: null,
          createdByUserId: "u-member"
        })
      })
    );
  });

  it("confirms personal AI drafts into AI_SELF work packages", async () => {
    const { confirmAgentBreakdownDraft } = await import("@/lib/services/agent-breakdown");
    let nextId = 20;
    mocks.prisma.agentBreakdownDraft.findUnique.mockResolvedValue({
      id: "draft-personal",
      projectId: null,
      createdByUserId: "u-member",
      prompt: "帮我拆解个人待办",
      analysisJson: JSON.stringify(personalAnalysis),
      status: "PENDING"
    });
    mocks.tx.workPackage.create.mockImplementation(async ({ data }: WorkPackageCreateMockArgs) =>
      storedWorkPackage({
        ...data,
        id: nextId++,
        projectId: null,
        status: data.status,
        priority: data.priority,
        riskLevel: data.riskLevel ?? null,
        riskImpact: data.riskImpact ?? null,
        riskMitigation: data.riskMitigation ?? null
      })
    );

    const result = await confirmAgentBreakdownDraft("draft-personal", participant);

    expect(result.workPackages).toHaveLength(2);
    expect(mocks.tx.workPackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: null,
          origin: "AI_SELF",
          createdByUserId: "u-member",
          assigneeId: "p2"
        })
      })
    );
    expect(result.workPackages.every((wp) => wp.origin === "aiSelf")).toBe(true);
  });
});

function storedWorkPackage(overrides: Partial<StoredWorkPackage>): StoredWorkPackage {
  return {
    id: 1,
    projectId: "proj-ai-pm",
    type: "TASK",
    subject: "工作项",
    description: "",
    status: "todo",
    priority: "P1",
    origin: "MANAGER",
    createdByUserId: "u-pm",
    assigneeId: null,
    parentId: null,
    startDate: null,
    dueDate: null,
    estimateHours: null,
    percentComplete: 0,
    lastProgressNote: "",
    dependencies: "[]",
    requiredSkills: "[]",
    riskLevel: null,
    riskImpact: null,
    riskMitigation: null,
    updatedAt: new Date("2026-04-29T00:00:00.000Z"),
    ...overrides
  };
}

import { describe, expect, it } from "vitest";
import { derivePlanMetrics, type PlanModel } from "@/lib/services/big-screen-plan";

describe("big screen derived plan metrics", () => {
  it("rolls task item progress and dates up while preserving configurable node difficulty", () => {
    const plan: PlanModel = {
      projectId: "proj-derived",
      projectName: "派生指标项目",
      projectCode: "DERIVED",
      subtitle: "质量指标测试",
      statusBadge: "执行中",
      progress: 0,
      projectDifficulty: "low",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-01T00:00:00.000Z",
      today: "2026-05-04T00:00:00.000Z",
      dependencies: [],
      phases: [
        {
          id: "phase-1",
          name: "阶段 1",
          startDate: "2026-05-01T00:00:00.000Z",
          endDate: "2026-05-01T00:00:00.000Z",
          progress: 0,
          difficulty: "low",
          summary: "测试阶段",
          riskCount: 0,
          taskCount: 0
        }
      ],
      nodes: [
        {
          id: "node-1",
          phaseId: "phase-1",
          shape: "task",
          label: "T1",
          title: "任务节点",
          date: "2026-05-01T00:00:00.000Z",
          startDate: "2026-05-01T00:00:00.000Z",
          endDate: "2026-05-01T00:00:00.000Z",
          difficulty: "low",
          progress: 0,
          tasks: [
            {
              id: "task-1",
              title: "前端实现",
              ownerLabel: "前端团队",
              startDate: "2026-05-02T00:00:00.000Z",
              endDate: "2026-05-06T00:00:00.000Z",
              difficulty: "medium",
              progress: 40,
              status: "in_progress"
            },
            {
              id: "task-2",
              title: "后端实现",
              ownerLabel: "后端团队",
              startDate: "2026-05-01T00:00:00.000Z",
              endDate: "2026-05-08T00:00:00.000Z",
              difficulty: "critical",
              progress: 80,
              status: "in_progress"
            }
          ],
          isOnCriticalPath: false
        }
      ]
    };

    const derived = derivePlanMetrics(plan);

    expect(derived.nodes[0].progress).toBe(60);
    expect(derived.nodes[0].difficulty).toBe("low");
    expect(derived.nodes[0].startDate).toBe("2026-05-01T00:00:00.000Z");
    expect(derived.nodes[0].endDate).toBe("2026-05-08T00:00:00.000Z");
    expect(derived.phases[0].progress).toBe(60);
    expect(derived.phases[0].difficulty).toBe("low");
    expect(derived.phases[0].startDate).toBe("2026-05-01T00:00:00.000Z");
    expect(derived.phases[0].endDate).toBe("2026-05-08T00:00:00.000Z");
    expect(derived.progress).toBe(60);
    expect(derived.projectDifficulty).toBe("low");
  });

  it("calculates phase and project difficulty from weighted difficulty ratios", () => {
    const basePhase = {
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-02T00:00:00.000Z",
      progress: 0,
      difficulty: "low" as const,
      summary: "测试阶段",
      riskCount: 0,
      taskCount: 0
    };
    const plan: PlanModel = {
      projectId: "proj-weighted",
      projectName: "加权难度项目",
      projectCode: "WEIGHTED",
      subtitle: "质量指标测试",
      statusBadge: "执行中",
      progress: 0,
      projectDifficulty: "low",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-02T00:00:00.000Z",
      today: "2026-05-04T00:00:00.000Z",
      dependencies: [],
      phases: [
        { ...basePhase, id: "phase-low", name: "低难阶段" },
        { ...basePhase, id: "phase-critical", name: "特别困难阶段" }
      ],
      nodes: [
        buildNode("node-low", "phase-low", "low"),
        buildNode("node-critical", "phase-critical", "critical")
      ]
    };

    const derived = derivePlanMetrics(plan);

    expect(derived.phases.find((phase) => phase.id === "phase-low")?.difficulty).toBe("low");
    expect(derived.phases.find((phase) => phase.id === "phase-critical")?.difficulty).toBe("critical");
    expect(derived.projectDifficulty).toBe("high");
  });

  it("amplifies difficulty for critical path, risk exposure, and blocked work", () => {
    const plan: PlanModel = {
      projectId: "proj-risk",
      projectName: "风险放大项目",
      projectCode: "RISK",
      subtitle: "质量指标测试",
      statusBadge: "执行中",
      progress: 0,
      projectDifficulty: "medium",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-02T00:00:00.000Z",
      today: "2026-05-04T00:00:00.000Z",
      dependencies: [],
      phases: [
        {
          id: "phase-risk",
          name: "风险阶段",
          startDate: "2026-05-01T00:00:00.000Z",
          endDate: "2026-05-02T00:00:00.000Z",
          progress: 0,
          difficulty: "medium",
          summary: "测试阶段",
          riskCount: 1,
          taskCount: 1
        }
      ],
      nodes: [
        {
          ...buildNode("node-risk", "phase-risk", "medium"),
          estimateHours: 10,
          riskLevel: "high",
          isBlocked: true,
          isOnCriticalPath: true
        }
      ]
    };

    const derived = derivePlanMetrics(plan);

    expect(derived.phases[0].difficultyScore).toBe(80);
    expect(derived.phases[0].difficulty).toBe("critical");
    expect(derived.projectDifficulty).toBe("critical");
  });

  it("derives delivery signals from task items when the node has no explicit values", () => {
    const plan: PlanModel = {
      projectId: "proj-task-signal",
      projectName: "任务项次信号项目",
      projectCode: "SIGNAL",
      subtitle: "质量指标测试",
      statusBadge: "执行中",
      progress: 0,
      projectDifficulty: "medium",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-02T00:00:00.000Z",
      today: "2026-05-04T00:00:00.000Z",
      dependencies: [],
      phases: [
        {
          id: "phase-signal",
          name: "信号阶段",
          startDate: "2026-05-01T00:00:00.000Z",
          endDate: "2026-05-02T00:00:00.000Z",
          progress: 0,
          difficulty: "medium",
          summary: "测试阶段",
          riskCount: 1,
          taskCount: 1
        }
      ],
      nodes: [
        {
          ...buildNode("node-signal", "phase-signal", "medium"),
          tasks: [
            {
              id: "task-signal",
              title: "存在风险的任务项",
              ownerLabel: "测试团队",
              estimateHours: 12,
              riskLevel: "high",
              isBlocked: true,
              progress: 50,
              status: "in_progress"
            }
          ]
        }
      ]
    };

    const derived = derivePlanMetrics(plan);

    expect(derived.nodes[0].estimateHours).toBe(12);
    expect(derived.nodes[0].riskLevel).toBe("high");
    expect(derived.nodes[0].isBlocked).toBe(true);
    expect(derived.nodes[0].progress).toBe(50);
    expect(derived.phases[0].difficulty).toBe("high");
  });

  it("keeps milestone date as the authoritative point date", () => {
    const plan: PlanModel = {
      projectId: "proj-milestone-date",
      projectName: "关键节点日期项目",
      projectCode: "MILESTONE",
      subtitle: "质量指标测试",
      statusBadge: "执行中",
      progress: 0,
      projectDifficulty: "low",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-10T00:00:00.000Z",
      today: "2026-05-04T00:00:00.000Z",
      dependencies: [],
      phases: [
        {
          id: "phase-milestone",
          name: "关键节点阶段",
          startDate: "2026-05-01T00:00:00.000Z",
          endDate: "2026-05-10T00:00:00.000Z",
          progress: 0,
          difficulty: "low",
          summary: "测试阶段",
          riskCount: 0,
          taskCount: 1
        }
      ],
      nodes: [
        {
          id: "milestone-1",
          phaseId: "phase-milestone",
          shape: "milestone",
          label: "M1",
          title: "关键节点",
          date: "2026-05-08T00:00:00.000Z",
          startDate: "2026-05-08T00:00:00.000Z",
          endDate: "2026-05-01T00:00:00.000Z",
          difficulty: "low",
          progress: 0,
          tasks: [],
          isOnCriticalPath: false
        }
      ]
    };

    const derived = derivePlanMetrics(plan);

    expect(derived.nodes[0].date).toBe("2026-05-08T00:00:00.000Z");
    expect(derived.nodes[0].startDate).toBe("2026-05-08T00:00:00.000Z");
    expect(derived.nodes[0].endDate).toBe("2026-05-08T00:00:00.000Z");
    expect(derived.phases[0].endDate).toBe("2026-05-08T00:00:00.000Z");
  });
});

function buildNode(id: string, phaseId: string, difficulty: PlanModel["nodes"][number]["difficulty"]) {
  return {
    id,
    phaseId,
    shape: "task" as const,
    label: id,
    title: id,
    date: "2026-05-02T00:00:00.000Z",
    startDate: "2026-05-01T00:00:00.000Z",
    endDate: "2026-05-02T00:00:00.000Z",
    difficulty,
    progress: 0,
    tasks: [],
    isOnCriticalPath: false
  };
}

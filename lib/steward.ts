import { calculateDashboardStats } from "./analytics";
import type { RiskLevel, StewardMessage, WorkspaceSnapshot } from "./types";

/**
 * Builds the AI steward report from current project data.
 */
export function buildStewardReport(snapshot: WorkspaceSnapshot) {
  const stats = calculateDashboardStats(snapshot);
  const highestRisk = getHighestRisk(snapshot);
  const overloaded = stats.workloadByPerson.filter((item) => item.loadRatio >= 80);

  return {
    summary: `当前平均进度 ${stats.averageProgress}%，阻塞工作项 ${stats.blockedCount} 个，高风险 ${stats.highRiskCount} 个。`,
    riskLevel: highestRisk,
    nextActions: [
      stats.blockedCount > 0 ? "优先处理阻塞工作项并补充依赖信息" : "继续推进 P0 和 P1 工作项",
      overloaded.length > 0
        ? `关注 ${overloaded.map((item) => item.person.name).join("、")} 的负载`
        : "人员负载当前可控",
      "保持测试、构建、部署健康检查可追溯"
    ]
  };
}

/**
 * Generates dashboard messages that can later be delivered through webhooks.
 */
export function generateStewardMessages(snapshot: WorkspaceSnapshot): StewardMessage[] {
  const report = buildStewardReport(snapshot);
  const now = new Date().toISOString();

  return [
    {
      id: `steward-progress-${Date.parse(now)}`,
      type: "progress",
      title: "AI 管家进展摘要",
      body: report.summary,
      level: report.riskLevel,
      createdAt: now
    },
    {
      id: `steward-actions-${Date.parse(now)}`,
      type: "planning",
      title: "建议下一步",
      body: report.nextActions.join("；"),
      level: report.riskLevel,
      createdAt: now
    }
  ];
}

function getHighestRisk(snapshot: WorkspaceSnapshot): RiskLevel {
  const risks = snapshot.workPackages.filter((wp) => wp.type === "risk");
  if (risks.some((wp) => wp.riskLevel === "High")) {
    return "High";
  }

  if (risks.some((wp) => wp.riskLevel === "Medium")) {
    return "Medium";
  }

  return "Low";
}

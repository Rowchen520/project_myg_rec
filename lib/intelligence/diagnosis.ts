import { calculateDashboardStats } from "../analytics";
import { calculateProjectHealthScores } from "./health";
import { buildReminderItems } from "./reminders";
import { buildSchedulingSuggestions } from "./scheduling";
import type {
  ProjectDiagnosis,
  ProjectDiagnosisAction,
  RiskLevel,
  WorkspaceSnapshot
} from "../types";

interface BuildDiagnosisOptions {
  /** Override the timestamp used by reminder calculation. */
  now?: Date;
}

/**
 * Aggregates health score, scheduling, reminders, and risks into a top-level
 * diagnosis. The diagnosis answers the product manager review question:
 * "what are the three most important actions right now?"
 */
export function buildProjectDiagnosis(
  snapshot: WorkspaceSnapshot,
  options: BuildDiagnosisOptions = {}
): ProjectDiagnosis {
  const now = options.now ?? new Date();
  const stats = calculateDashboardStats(snapshot);
  const healthScores = calculateProjectHealthScores(snapshot);
  const schedulingSuggestions = buildSchedulingSuggestions(snapshot);
  const reminders = buildReminderItems(snapshot, { now });

  const aggregateScore = healthScores.length
    ? Math.round(healthScores.reduce((total, score) => total + score.score, 0) / healthScores.length)
    : 0;
  const overallLevel = inferOverallLevel(aggregateScore, stats.blockedCount, stats.highRiskCount);
  const summary = buildSummary(aggregateScore, stats.blockedCount, stats.highRiskCount, reminders.length);

  const actions: ProjectDiagnosisAction[] = [];

  const blockedReminder = reminders.find((reminder) => reminder.level === "High");
  if (blockedReminder) {
    actions.push({
      id: `act-blocked-${blockedReminder.workPackageId}`,
      title: `优先解锁阻塞：${blockedReminder.workPackageSubject}`,
      detail: blockedReminder.message,
      level: "High",
      route: "reminder",
      workPackageId: blockedReminder.workPackageId
    });
  }

  const overload = stats.workloadByPerson.find((item) => item.loadRatio >= 100);
  if (overload) {
    const rebalance = schedulingSuggestions.find(
      (suggestion) =>
        suggestion.currentAssigneeId === overload.person.id &&
        suggestion.suggestedPersonId !== overload.person.id
    );

    actions.push({
      id: `act-overload-${overload.person.id}`,
      title: `重新分配 ${overload.person.name} 的工作项（负载 ${overload.loadRatio}%）`,
      detail: rebalance
        ? `建议把「${rebalance.workPackageSubject}」交给更匹配的成员，原因：${rebalance.reason}`
        : `当前负载已超出容量，需要项目经理确认排期或拆解工作项。`,
      level: "Medium",
      route: rebalance ? "scheduling" : "overview",
      workPackageId: rebalance?.workPackageId
    });
  }

  const highImpactSuggestion = schedulingSuggestions.find(
    (suggestion) =>
      suggestion.suggestedPersonId !== suggestion.currentAssigneeId && suggestion.urgency >= 6
  );
  if (
    highImpactSuggestion &&
    !actions.some((action) => action.workPackageId === highImpactSuggestion.workPackageId)
  ) {
    actions.push({
      id: `act-suggestion-${highImpactSuggestion.workPackageId}`,
      title: `采纳调度建议：${highImpactSuggestion.workPackageSubject}`,
      detail: highImpactSuggestion.reason,
      level: "Medium",
      route: "scheduling",
      workPackageId: highImpactSuggestion.workPackageId
    });
  }

  if (actions.length < 3) {
    const dueSoon = reminders.find(
      (reminder) =>
        reminder.level !== "High" &&
        typeof reminder.daysUntilDue === "number" &&
        reminder.daysUntilDue <= 3 &&
        !actions.some((action) => action.workPackageId === reminder.workPackageId)
    );

    if (dueSoon) {
      actions.push({
        id: `act-due-${dueSoon.workPackageId}`,
        title: `临期跟进：${dueSoon.workPackageSubject}`,
        detail: dueSoon.message,
        level: dueSoon.level,
        route: "reminder",
        workPackageId: dueSoon.workPackageId
      });
    }
  }

  if (actions.length === 0) {
    actions.push({
      id: "act-keep-pace",
      title: "保持当前节奏，推进 P0 工作项",
      detail: `项目健康度 ${aggregateScore}，当前没有阻塞或过载，继续按计划交付即可。`,
      level: "Low",
      route: "overview"
    });
  }

  return {
    overallLevel,
    overallScore: aggregateScore,
    summary,
    actions: actions.slice(0, 3),
    contributors: buildContributorList(stats, reminders.length, schedulingSuggestions.length)
  };
}

function inferOverallLevel(score: number, blockedCount: number, highRiskCount: number): RiskLevel {
  if (score < 55 || highRiskCount > 0 || blockedCount >= 2) {
    return "High";
  }

  if (score < 78 || blockedCount > 0) {
    return "Medium";
  }

  return "Low";
}

function buildSummary(
  score: number,
  blockedCount: number,
  highRiskCount: number,
  reminderCount: number
): string {
  const blocked = blockedCount > 0 ? `阻塞 ${blockedCount} 个，` : "";
  const risk = highRiskCount > 0 ? `高风险 ${highRiskCount} 个，` : "";
  const reminder = reminderCount > 0 ? `${reminderCount} 项待催办` : "无紧急催办";
  return `平均健康度 ${score}，${blocked}${risk}${reminder}。AI 已合成最关键的 3 项动作。`;
}

function buildContributorList(
  stats: ReturnType<typeof calculateDashboardStats>,
  reminderCount: number,
  suggestionCount: number
): string[] {
  return [
    `平均完成率 ${stats.averageProgress}%`,
    `阻塞工作项 ${stats.blockedCount} 个`,
    `高风险 ${stats.highRiskCount} 个`,
    `调度建议 ${suggestionCount} 条`,
    `智能催办 ${reminderCount} 条`
  ];
}

import Link from "next/link";
import { Badge } from "@/components/primer/Badge";
import type { ProjectOverviewMetric } from "@/lib/services/platform-overview";

interface ProjectKpiCardProps {
  metric: ProjectOverviewMetric;
}

/**
 * Project-level KPI card shared by launch and overview surfaces.
 */
export function ProjectKpiCard({ metric }: ProjectKpiCardProps) {
  return (
    <div
      className="surface"
      style={{ color: "inherit", textDecoration: "none" }}
    >
      <div className="surface__body" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <Link
            href={`/projects/${metric.projectIdentifier}/overview`}
            style={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
          >
            {metric.projectName}
          </Link>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Link
              href={`/overview/screen?projectId=${metric.projectId}`}
              className="screen-entry-link"
              title="进入项目大屏看板模式"
            >
              大屏
            </Link>
            <Badge tone={metric.health === "High" ? "danger" : metric.health === "Medium" ? "attention" : "success"}>
              {metric.health}
            </Badge>
          </div>
        </div>
        <div>
          <div className="progress-bar" aria-label={`进度 ${metric.progress}%`}>
            <span style={{ width: `${metric.progress}%` }} />
          </div>
          <p className="hint" style={{ margin: "6px 0 0", fontSize: 12 }}>
            {metric.taskDone}/{metric.taskTotal} 已完成 · 成员 {metric.memberCount} · 活跃负责人 {metric.activeAssigneeCount}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone={metric.highRiskCount > 0 ? "danger" : "default"}>高风险 {metric.highRiskCount}</Badge>
          <Badge tone={metric.overdueCount > 0 ? "danger" : "default"}>逾期 {metric.overdueCount}</Badge>
          <Badge tone={metric.blockedCount > 0 ? "attention" : "default"}>阻塞 {metric.blockedCount}</Badge>
        </div>
        {metric.upcomingMilestones.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--fg-muted)" }}>
            {metric.upcomingMilestones.map((milestone) => (
              <li key={milestone.id}>
                {milestone.subject} · {milestone.daysUntilDue} 天后
              </li>
            ))}
          </ul>
        ) : null}
        <p className="hint" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          {metric.aiSummary}
        </p>
      </div>
    </div>
  );
}

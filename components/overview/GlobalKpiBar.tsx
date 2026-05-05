import type { GlobalOverviewKpi } from "@/lib/services/platform-overview";

interface GlobalKpiBarProps {
  kpi: GlobalOverviewKpi;
}

/**
 * Compact KPI strip for the platform overview page.
 */
export function GlobalKpiBar({ kpi }: GlobalKpiBarProps) {
  return (
    <div className="stat-grid">
      <Kpi label="项目总数" value={kpi.projectCount} />
      <Kpi label="活跃项目" value={kpi.activeProjectCount} tone="success" />
      <Kpi label="工作项" value={`${kpi.doneWorkPackageCount}/${kpi.workPackageCount}`} />
      <Kpi label="高风险项目" value={kpi.highRiskProjectCount} tone="danger" />
      <Kpi label="逾期工作项" value={kpi.overdueWorkPackageCount} tone="danger" />
      <Kpi label="阻塞工作项" value={kpi.blockedWorkPackageCount} tone="attention" />
      <Kpi label="近期里程碑" value={kpi.upcomingMilestoneCount} tone="accent" />
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "success" | "attention" | "accent";
}) {
  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value" data-tone={tone}>{value}</p>
    </div>
  );
}

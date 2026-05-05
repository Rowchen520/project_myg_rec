import { Surface } from "@/components/primer/Surface";
import { GlobalKpiBar } from "./GlobalKpiBar";
import { ProjectKpiCard } from "./ProjectKpiCard";
import type { PlatformOverviewSnapshot } from "@/lib/services/platform-overview";

interface PlatformOverviewProps {
  overview: PlatformOverviewSnapshot;
}

/**
 * Top-level platform overview dashboard.
 */
export function PlatformOverview({ overview }: PlatformOverviewProps) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <GlobalKpiBar kpi={overview.global} />
      <div className="card-grid">
        {overview.projects.map((metric) => (
          <ProjectKpiCard key={metric.projectId} metric={metric} />
        ))}
      </div>
      <div className="split-pane">
        <Ranking title="高风险工作项" items={overview.highRiskWorkPackages.map((wp) => `#${wp.id} ${wp.subject}`)} />
        <Ranking title="逾期工作项" items={overview.overdueWorkPackages.map((wp) => `#${wp.id} ${wp.subject}`)} />
      </div>
    </div>
  );
}

function Ranking({ title, items }: { title: string; items: string[] }) {
  return (
    <Surface title={title}>
      {items.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>暂无数据。</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      )}
    </Surface>
  );
}

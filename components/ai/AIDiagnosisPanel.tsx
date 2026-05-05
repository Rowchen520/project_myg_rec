"use client";

import Link from "next/link";
import { Badge } from "@/components/primer/Badge";
import { Surface } from "@/components/primer/Surface";
import { riskLevelTone } from "@/lib/work-package-presentation";
import type { ProjectDiagnosis } from "@/lib/types";

interface AIDiagnosisPanelProps {
  diagnosis: ProjectDiagnosis;
  projectIdentifier: string;
}

const ROUTE_LABELS: Record<ProjectDiagnosis["actions"][number]["route"], string> = {
  reminder: "工作项详情",
  scheduling: "工作项列表",
  overview: "项目概览"
};

/**
 * Renders the project AI diagnosis as a Primer-styled card.
 */
export function AIDiagnosisPanel({ diagnosis, projectIdentifier }: AIDiagnosisPanelProps) {
  const actionLabel = `现在最该做的 ${diagnosis.actions.length} 件事`;

  return (
    <Surface
      title="AI 诊断"
      description={diagnosis.summary}
      actions={<Badge tone={riskLevelTone(diagnosis.overallLevel)}>综合等级 {diagnosis.overallLevel}</Badge>}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(160px, 220px) 1fr",
          gap: 16,
          alignItems: "stretch",
          marginBottom: 16
        }}
      >
        <div
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-medium)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center"
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 4 }}>综合健康度</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--accent-fg)"
              }}
            >
              {diagnosis.overallScore}
            </span>
            <span className="hint mono" style={{ fontSize: 13 }}>/ 100</span>
          </div>
        </div>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 6
          }}
        >
          {diagnosis.contributors.map((label) => (
            <li
              key={label}
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                color: "var(--fg-default)"
              }}
            >
              {label}
            </li>
          ))}
        </ul>
      </div>

      <h3 style={{ fontSize: 13, margin: "0 0 8px", fontWeight: 600 }}>{actionLabel}</h3>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {diagnosis.actions.map((action, index) => {
          const target = action.workPackageId
            ? `/projects/${projectIdentifier}/work-packages/${action.workPackageId}`
            : action.route === "scheduling"
              ? `/projects/${projectIdentifier}/work-packages`
              : `/projects/${projectIdentifier}/overview`;
          return (
            <li
              key={action.id}
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: 12,
                display: "grid",
                gridTemplateColumns: "32px 1fr auto",
                gap: 12,
                alignItems: "center"
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background:
                    action.level === "High"
                      ? "var(--danger-subtle)"
                      : action.level === "Medium"
                        ? "var(--attention-subtle)"
                        : "var(--accent-subtle)",
                  color:
                    action.level === "High"
                      ? "var(--danger-emphasis)"
                      : action.level === "Medium"
                        ? "var(--attention-emphasis)"
                        : "var(--accent-emphasis)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 12
                }}
              >
                {index + 1}
              </span>
              <div>
                <strong style={{ fontSize: 13 }}>{action.title}</strong>
                <p className="hint" style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5 }}>
                  {action.detail}
                </p>
              </div>
              <Link href={target} className="btn" data-size="sm">
                {ROUTE_LABELS[action.route]}
              </Link>
            </li>
          );
        })}
      </ol>
    </Surface>
  );
}

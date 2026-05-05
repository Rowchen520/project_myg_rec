import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AIDiagnosisPanel } from "@/components/ai/AIDiagnosisPanel";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { buildProjectDiagnosis } from "@/lib/intelligence/diagnosis";
import { buildReminderItems } from "@/lib/intelligence/reminders";
import { buildSchedulingSuggestions } from "@/lib/intelligence/scheduling";
import { riskLevelTone } from "@/lib/work-package-presentation";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectAIDiagnosisPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }
  if (!project.enabledModules.includes("ai_diagnosis")) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "项目", href: "/projects" },
            { label: project.name, href: `/projects/${project.identifier}/overview` },
            { label: "AI 诊断" }
          ]}
        />
        <EmptyState
          title="该项目尚未启用 AI 诊断模块"
          description="可在「项目设置」勾选 AI 诊断后再访问。"
          action={
            <Link href={`/projects/${project.identifier}/settings`} className="btn" data-size="sm">
              打开项目设置
            </Link>
          }
        />
      </>
    );
  }

  const projectScope = {
    ...snapshot,
    projects: [project],
    workPackages: snapshot.workPackages.filter((wp) => wp.projectId === project.id)
  };
  const diagnosis = buildProjectDiagnosis(projectScope);
  const reminders = buildReminderItems(projectScope);
  const suggestions = buildSchedulingSuggestions(projectScope);
  const personLookup = new Map(snapshot.people.map((person) => [person.id, person]));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "AI 诊断" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">AI 诊断</h1>
          <p className="page-subtitle">综合健康度、智能催办与调度建议，给出最关键的下一步动作。</p>
        </div>
      </header>

      <AIDiagnosisPanel diagnosis={diagnosis} projectIdentifier={project.identifier} />

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        }}
      >
        <Surface
          title={`智能催办 (${reminders.length})`}
          description="按紧急度排序的待跟进工作项。"
          flush
        >
          {reminders.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState title="暂无紧急催办项" />
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {reminders.map((item, index) => (
                <li
                  key={item.workPackageId}
                  style={{
                    padding: 12,
                    borderTop: index === 0 ? undefined : "1px solid var(--border-muted)"
                  }}
                >
                  <Link
                    href={`/projects/${project.identifier}/work-packages/${item.workPackageId}`}
                    style={{ display: "block", color: "var(--fg-default)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>
                        <span className="hint mono" style={{ marginRight: 4 }}>#{item.workPackageId}</span>
                        {item.workPackageSubject}
                      </strong>
                      <Badge tone={riskLevelTone(item.level)}>{item.level}</Badge>
                    </div>
                    <p className="hint" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
                      {item.message}
                    </p>
                    <p className="hint" style={{ marginTop: 4, fontSize: 11 }}>
                      {item.ownerName} · 待办 {item.daysIdle} 天
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface
          title={`调度建议 (${suggestions.length})`}
          description="基于技能匹配与负载分布。"
          flush
        >
          {suggestions.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState title="暂无可采纳的调度建议" />
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {suggestions.map((suggestion, index) => {
                const target = personLookup.get(suggestion.suggestedPersonId);
                const current = suggestion.currentAssigneeId
                  ? personLookup.get(suggestion.currentAssigneeId)
                  : undefined;
                return (
                  <li
                    key={suggestion.workPackageId}
                    style={{
                      padding: 12,
                      borderTop: index === 0 ? undefined : "1px solid var(--border-muted)"
                    }}
                  >
                    <Link
                      href={`/projects/${project.identifier}/work-packages/${suggestion.workPackageId}`}
                      style={{ display: "block", color: "var(--fg-default)" }}
                    >
                      <strong style={{ fontSize: 13 }}>
                        <span className="hint mono" style={{ marginRight: 4 }}>#{suggestion.workPackageId}</span>
                        {suggestion.workPackageSubject}
                      </strong>
                      <p className="hint" style={{ marginTop: 6, fontSize: 12 }}>
                        {current?.name ? `${current.name} → ` : ""}
                        <strong style={{ color: "var(--accent-fg)" }}>
                          {target?.name ?? suggestion.suggestedPersonId}
                        </strong>
                      </p>
                      <p className="hint" style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
                        {suggestion.reason}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
      </div>
    </>
  );
}

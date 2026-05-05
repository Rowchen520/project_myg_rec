import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/primer/Badge";
import { Surface } from "@/components/primer/Surface";
import { buildPlatformOverviewSnapshot } from "@/lib/services/platform-overview";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { rememberLaunchSkipped, rememberSelectedProject } from "@/lib/services/launch-preferences";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const launchEnabled = await isModuleEnabledForUser("launchPage", currentUser);
  if (!launchEnabled) {
    redirect("/my/page");
  }

  const overview = buildPlatformOverviewSnapshot(snapshot, currentUser);

  async function selectProject(formData: FormData) {
    "use server";
    const projectId = String(formData.get("projectId") ?? "");
    const identifier = String(formData.get("identifier") ?? "");
    await rememberSelectedProject(projectId);
    redirect(`/projects/${identifier}/overview`);
  }

  async function skipLaunch() {
    "use server";
    await rememberLaunchSkipped();
    redirect("/my/page");
  }

  return (
    <>
      <Breadcrumb items={[{ label: "启动选择" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">选择要进入的项目</h1>
          <p className="page-subtitle">
            从可见项目中选择一个继续工作，或跳过进入我的工作台。
          </p>
        </div>
        <form action={skipLaunch}>
          <button className="btn" data-size="sm" type="submit">
            进入我的工作台
          </button>
        </form>
      </header>

      <div className="card-grid">
        {overview.projects.map((metric) => (
          <form key={metric.projectId} action={selectProject}>
            <input type="hidden" name="projectId" value={metric.projectId} />
            <input type="hidden" name="identifier" value={metric.projectIdentifier} />
            <button
              type="submit"
              className="surface"
              style={{
                width: "100%",
                textAlign: "left",
                border: "1px solid var(--border-default)",
                cursor: "pointer"
              }}
            >
              <div className="surface__body" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{metric.projectName}</strong>
                  <Badge tone={metric.health === "High" ? "danger" : metric.health === "Medium" ? "attention" : "success"}>
                    {metric.health}
                  </Badge>
                </div>
                <div>
                  <div className="progress-bar" aria-hidden="true">
                    <span style={{ width: `${metric.progress}%` }} />
                  </div>
                  <p className="hint" style={{ margin: "6px 0 0", fontSize: 12 }}>
                    进度 {metric.progress}% · 高风险 {metric.highRiskCount} · 逾期 {metric.overdueCount}
                  </p>
                </div>
              </div>
            </button>
          </form>
        ))}
      </div>

      {overview.projects.length === 0 ? (
        <Surface title="暂无可进入项目">
          <p className="hint" style={{ margin: 0 }}>
            当前账号没有可见项目，可先进入我的工作台处理个人事项。
          </p>
        </Surface>
      ) : null}
    </>
  );
}

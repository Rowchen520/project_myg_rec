import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { GlobalWorkPackagesView } from "@/components/work-packages/GlobalWorkPackagesView";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function GlobalWorkPackagesPage() {
  const { snapshot } = await getShellRequestContext();

  return (
    <>
      <Breadcrumb items={[{ label: "工作项" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">全局工作项</h1>
          <p className="page-subtitle">
            跨项目浏览所有工作项。点击主题进入对应项目的工作项详情。
          </p>
        </div>
      </header>
      <GlobalWorkPackagesView
        workPackages={snapshot.workPackages}
        projects={snapshot.projects}
        people={snapshot.people}
      />
    </>
  );
}

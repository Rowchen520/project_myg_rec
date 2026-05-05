import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PlatformOverview } from "@/components/overview/PlatformOverview";
import { can } from "@/lib/rbac";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { buildPlatformOverviewSnapshot } from "@/lib/services/platform-overview";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const enabled = await isModuleEnabledForUser("platformOverview", currentUser);
  if (!enabled || (currentUser && !can(currentUser.role, "viewPlatformOverview"))) {
    redirect("/my/page");
  }

  const overview = buildPlatformOverviewSnapshot(snapshot, currentUser);

  return (
    <>
      <Breadcrumb items={[{ label: "平台总览" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">平台总览</h1>
          <p className="page-subtitle">
            以仪表盘方式总览当前账号可见项目的进度、风险、逾期、阻塞和近期里程碑。
          </p>
        </div>
      </header>
      <PlatformOverview overview={overview} />
    </>
  );
}

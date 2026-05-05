import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FeatureFlagsTable } from "@/components/admin/FeatureFlagsTable";
import { Surface } from "@/components/primer/Surface";
import { listPlatformFeatureFlags } from "@/lib/services/feature-flags";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const { currentUser } = await getShellRequestContext();
  const flags = await listPlatformFeatureFlags();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "管理员", href: "/admin" },
          { label: "平台模块开关" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">平台模块开关</h1>
          <p className="page-subtitle">
            配置站点级开关与角色级可见性，关闭后对应入口会从侧栏或工作台隐藏。
          </p>
        </div>
      </header>
      <Surface title="模块可见性" flush>
        <FeatureFlagsTable flags={flags} currentUser={currentUser} />
      </Surface>
    </>
  );
}

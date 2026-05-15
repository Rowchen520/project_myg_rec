import { NotificationSettingsView } from "@/components/admin/NotificationSettingsView";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const { snapshot } = await getShellRequestContext();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "管理员", href: "/admin" },
          { label: "通知配置" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">通知配置</h1>
          <p className="page-subtitle">
            在管理员区统一查看通讯通道和路由规则；通知中心本身只保留站内消息收件箱。
          </p>
        </div>
      </header>
      <NotificationSettingsView
        channels={snapshot.notificationChannels}
        rules={snapshot.notificationRules}
      />
    </>
  );
}
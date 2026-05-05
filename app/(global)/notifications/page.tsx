import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { NotificationCenterView } from "@/components/notifications/NotificationCenterView";
import { can } from "@/lib/rbac";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const canManage = currentUser ? can(currentUser.role, "manageNotifications") : false;

  return (
    <>
      <Breadcrumb items={[{ label: "通知中心" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">通知中心</h1>
          <p className="page-subtitle">
            统一查看 AI 管家与项目事件向飞书 / 企业微信 / 钉钉 / 邮件等通道的投递记录。
          </p>
        </div>
      </header>
      <NotificationCenterView
        channels={snapshot.notificationChannels}
        rules={snapshot.notificationRules}
        stewardMessages={snapshot.stewardMessages}
        currentUser={currentUser}
        canManage={canManage}
      />
    </>
  );
}

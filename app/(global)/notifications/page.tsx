import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { NotificationCenterView } from "@/components/notifications/NotificationCenterView";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { listInboxUserNotifications, listPendingNotificationReviewRequests } from "@/lib/services/user-notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { currentUser } = await getShellRequestContext();
  const [notifications, pendingReviews] = currentUser
    ? await Promise.all([
        listInboxUserNotifications(currentUser.id, 100),
        listPendingNotificationReviewRequests(currentUser.id)
      ])
    : [[], []];

  return (
    <>
      <Breadcrumb items={[{ label: "通知中心" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">通知中心</h1>
          <p className="page-subtitle">
            统一接收业务操作发送到当前用户的站内消息。
          </p>
        </div>
      </header>
      <NotificationCenterView
        notifications={notifications}
        pendingReviews={pendingReviews}
        currentUser={currentUser}
      />
    </>
  );
}

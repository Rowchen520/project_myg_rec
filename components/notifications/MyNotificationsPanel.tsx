import { Badge } from "@/components/primer/Badge";
import { listInboxUserNotifications } from "@/lib/services/user-notifications";
import type { User } from "@/lib/types";

interface MyNotificationsPanelProps {
  currentUser?: User;
}

/**
 * Shows the latest in-app inbox notifications relevant to the current user.
 */
export async function MyNotificationsPanel({ currentUser }: MyNotificationsPanelProps) {
  if (!currentUser) {
    return null;
  }

  const notifications = await listInboxUserNotifications(currentUser.id, 5);

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {notifications.length === 0 ? <li className="hint">暂无个人通知。</li> : null}
      {notifications.map((notification) => (
        <li
          key={notification.id}
          className="muted-card"
          style={{ padding: 10, display: "grid", gap: 4 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>{notification.title}</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge tone={notification.level === "High" ? "danger" : notification.level === "Low" ? "success" : "default"}>
                {notification.level}
              </Badge>
              <Badge tone={notification.readAt ? "default" : "accent"}>{notification.readAt ? "已读" : "未读"}</Badge>
            </div>
          </div>
          <p className="hint" style={{ margin: 0, fontSize: 12 }}>
            {notification.body}
          </p>
          <p className="hint" style={{ margin: 0, fontSize: 11 }}>
            {notification.source} · {new Date(notification.createdAt).toLocaleString("zh-CN")}
          </p>
        </li>
      ))}
    </ul>
  );
}

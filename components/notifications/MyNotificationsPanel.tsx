import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/primer/Badge";
import type { User } from "@/lib/types";

interface MyNotificationsPanelProps {
  currentUser?: User;
}

/**
 * Shows the latest notification deliveries relevant to the current user's role.
 */
export async function MyNotificationsPanel({ currentUser }: MyNotificationsPanelProps) {
  if (!currentUser) {
    return null;
  }

  const deliveries = await prisma.notificationDelivery.findMany({
    where: {
      audienceRoles: { contains: currentUser.role }
    },
    include: {
      channel: true,
      rule: true
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {deliveries.length === 0 ? <li className="hint">暂无个人通知。</li> : null}
      {deliveries.map((delivery) => (
        <li
          key={delivery.id}
          className="muted-card"
          style={{ padding: 10, display: "grid", gap: 4 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>{delivery.rule.name}</strong>
            <Badge tone={delivery.status === "FAILED" ? "danger" : delivery.status === "SENT" ? "success" : "default"}>
              {delivery.status}
            </Badge>
          </div>
          <p className="hint" style={{ margin: 0, fontSize: 12 }}>
            {delivery.preview}
          </p>
          <p className="hint" style={{ margin: 0, fontSize: 11 }}>
            {delivery.channel.name} · {delivery.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

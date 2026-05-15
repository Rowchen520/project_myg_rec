"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { riskLevelTone } from "@/lib/work-package-presentation";
import type { NotificationReviewRequest, User, UserNotification } from "@/lib/types";

interface NotificationCenterViewProps {
  notifications: UserNotification[];
  pendingReviews: NotificationReviewRequest[];
  currentUser?: User;
}

type NotificationViewTab = "inbox" | "pendingReviews";

export function NotificationCenterView({ notifications, pendingReviews, currentUser }: NotificationCenterViewProps) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [reviewItems, setReviewItems] = useState(pendingReviews);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationViewTab>("inbox");
  const markableUnreadCount = useMemo(
    () => items.filter((item) => !item.readAt && !isLockedReviewNotification(item)).length,
    [items]
  );

  async function markAllRead() {
    if (!currentUser || busy || markableUnreadCount === 0) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "一键已读失败。");
      }

      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          !item.readAt && !isLockedReviewNotification(item)
            ? { ...item, readAt: now }
            : item
        )
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "一键已读失败。");
    } finally {
      setBusy(false);
    }
  }

  async function completeReview(reviewId: string, status: "approved" | "rejected") {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/reviews/${reviewId}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "提交审核失败。");
      }

      const now = new Date().toISOString();
      setReviewItems((current) => current.filter((item) => item.id !== reviewId));
      setItems((current) =>
        current.map((item) =>
          item.source === "notification-review-request" && item.payload?.reviewRequestId === reviewId
            ? { ...item, readAt: item.readAt ?? now }
            : item
        )
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交审核失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface
      title={activeTab === "inbox" ? `收件箱 (${items.length})` : `待审核 (${reviewItems.length})`}
      description={
        currentUser
          ? activeTab === "inbox"
            ? "这里展示当前用户收到的普通通知和审核结果消息；待处理的审核请求已单独收口到“待审核”。"
            : "待审核只展示当前用户仍需处理的审核请求，审核完成后会自动从列表移除。"
          : "登录后可查看通知中心消息。"
      }
      actions={
        currentUser ? (
          activeTab === "inbox" ? (
            <Button size="sm" variant="primary" disabled={busy || markableUnreadCount === 0} onClick={markAllRead}>
              {busy ? "处理中..." : `一键已读${markableUnreadCount ? ` (${markableUnreadCount})` : ""}`}
            </Button>
          ) : null
        ) : null
      }
      flush
    >
      {error ? <p style={{ color: "var(--danger-fg)", margin: "0 16px", fontSize: 12 }}>{error}</p> : null}
      {currentUser ? (
        <div style={{ display: "flex", gap: 8, padding: 16, paddingBottom: 0, flexWrap: "wrap" }}>
          <Button size="sm" variant={activeTab === "inbox" ? "primary" : "ghost"} onClick={() => setActiveTab("inbox")}>
            收件箱
          </Button>
          <Button size="sm" variant={activeTab === "pendingReviews" ? "primary" : "ghost"} onClick={() => setActiveTab("pendingReviews")}>
            待审核{reviewItems.length ? ` (${reviewItems.length})` : ""}
          </Button>
        </div>
      ) : null}
      {!currentUser ? (
        <div style={{ padding: 16 }}>
          <EmptyState title="当前未登录" description="登录后才能查看通知中心消息。" />
        </div>
      ) : activeTab === "inbox" && items.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            title="暂无消息"
            description="业务操作触发站内通知后，会在这里按时间倒序展示。"
          />
        </div>
      ) : activeTab === "pendingReviews" && reviewItems.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            title="暂无待审核消息"
            description="新的审核请求到达后，会在这里集中展示，必须处理后才会从未读中消失。"
          />
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {activeTab === "inbox"
            ? items.map((notification, index) => (
                <li
                  key={notification.id}
                  style={{
                    padding: "12px 16px",
                    borderTop: index === 0 ? undefined : "1px solid var(--border-muted)",
                    display: "grid",
                    gap: 6,
                    background: notification.readAt ? undefined : "var(--bg-subtle)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4, minWidth: 0, flex: "1 1 260px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Badge tone={riskLevelTone(notification.level)}>{notification.level}</Badge>
                        <Badge tone={notification.readAt ? "default" : "accent"}>{notification.readAt ? "已读" : "未读"}</Badge>
                        <Badge tone={notification.source === "notification-review-result" ? "success" : "default"}>
                          {notification.source === "notification-review-result"
                              ? "审核结果"
                              : "通知消息"}
                        </Badge>
                        <strong style={{ fontSize: 13 }}>{notification.title}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--fg-default)" }}>{notification.body}</p>
                      <p className="hint" style={{ margin: 0, fontSize: 11 }}>
                        来源 {notification.source} · {formatTimestamp(notification.createdAt)}
                        {notification.readAt ? ` · 已读于 ${formatTimestamp(notification.readAt)}` : ""}
                      </p>
                    </div>
                    {notification.link ? (
                      <a href={notification.link} className="btn" data-size="sm" data-variant="ghost">
                        查看详情
                      </a>
                    ) : null}
                  </div>
                </li>
              ))
            : reviewItems.map((review, index) => (
                <li
                  key={review.id}
                  style={{
                    padding: "12px 16px",
                    borderTop: index === 0 ? undefined : "1px solid var(--border-muted)",
                    display: "grid",
                    gap: 8,
                    background: "var(--bg-subtle)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4, minWidth: 0, flex: "1 1 260px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Badge tone="attention">待审核</Badge>
                        <strong style={{ fontSize: 13 }}>{review.title}</strong>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--fg-default)" }}>{review.body}</p>
                      <p className="hint" style={{ margin: 0, fontSize: 11 }}>
                        创建于 {formatTimestamp(review.createdAt)} · 审核完成后会自动标记原审核消息为已读
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button size="sm" variant="success" disabled={busy} onClick={() => completeReview(review.id, "approved")}>
                        通过
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => completeReview(review.id, "rejected")}>
                        驳回
                      </Button>
                      {review.link ? (
                        <a href={review.link} className="btn" data-size="sm" data-variant="ghost">
                          查看详情
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
        </ul>
      )}
    </Surface>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

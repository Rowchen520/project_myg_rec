"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { roleLabels } from "@/lib/rbac";
import type { User } from "@/lib/types";

interface UserMenuProps {
  currentUser?: User;
}

const DEMO_ACCOUNTS: Array<{ id: string; name: string; role: User["role"] }> = [
  { id: "u-admin", name: "平台管理员", role: "admin" },
  { id: "u-pm", name: "项目经理", role: "projectManager" },
  { id: "u-member", name: "项目参与员", role: "participant" }
];

/**
 * Top-bar avatar + role switcher. The MVP carries the active user via the
 * `x-user-id` header read in route handlers; this menu lets demo viewers
 * switch role without manually editing requests.
 */
export function UserMenu({ currentUser }: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function selectUser(userId: string) {
    setOpen(false);
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
    } catch {
      // ignore network errors; the next refresh will keep the prior cookie
    }
    router.refresh();
  }

  async function signOut() {
    setOpen(false);
    try {
      await fetch("/api/session", { method: "DELETE" });
    } catch {
      // ignore network errors and still refresh to surface the login gate
    }
    window.location.assign("/my/page");
  }

  const redirectTo = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const feishuLoginHref = `/api/auth/feishu/login?redirectTo=${encodeURIComponent(redirectTo || "/")}`;

  const initial = currentUser?.name.slice(0, 1) ?? "?";
  const title = currentUser
    ? `${currentUser.name} · ${roleLabels[currentUser.role]}`
    : "选择演示账号";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn"
        data-variant="ghost"
        data-size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ padding: 4, gap: 0 }}
        title={title}
      >
        <span
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--accent-fg)",
            color: "var(--fg-on-emphasis)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 11
          }}
        >
          {initial}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="fade-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 224,
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-medium)",
            boxShadow: "var(--shadow-large)",
            padding: 6,
            zIndex: 40
          }}
        >
          <div style={{ padding: "8px 10px 6px" }}>
            <strong style={{ display: "block", fontSize: 13, color: "var(--fg-default)" }}>
              {currentUser?.name ?? "未登录"}
            </strong>
            <p className="hint" style={{ margin: 0, fontSize: 11 }}>
              {currentUser ? roleLabels[currentUser.role] : "请选择下方演示账号"}
            </p>
          </div>
          <hr className="divider" />
          <p className="sidebar-section-title" style={{ padding: "4px 10px 4px", marginBottom: 2 }}>
            演示账号
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.id}
                type="button"
                className="sidebar-link"
                data-active={currentUser?.id === account.id}
                onClick={() => selectUser(account.id)}
                style={{ border: "none", background: undefined, textAlign: "left" }}
              >
                <span className="sidebar-link__icon">{currentUser?.id === account.id ? <CheckIcon /> : <DotIcon />}</span>
                <span style={{ flex: 1 }}>{account.name}</span>
                <span className="hint" style={{ fontSize: 11 }}>
                  {roleLabels[account.role]}
                </span>
              </button>
            ))}
          </div>
          <hr className="divider" />
          {currentUser ? (
            <>
              <p className="sidebar-section-title" style={{ padding: "4px 10px 4px", marginBottom: 2 }}>
                账号
              </p>
              <a href="/my/feishu" className="sidebar-link" style={{ textDecoration: "none" }}>
                <span className="sidebar-link__icon">
                  <FeishuIcon />
                </span>
                <span style={{ flex: 1 }}>飞书账号设置</span>
              </a>
              <button
                type="button"
                className="sidebar-link"
                onClick={signOut}
                style={{ border: "none", background: undefined, textAlign: "left" }}
              >
                <span className="sidebar-link__icon">
                  <ExitIcon />
                </span>
                <span style={{ flex: 1 }}>退出登录</span>
              </button>
              <hr className="divider" />
            </>
          ) : null}
          <p className="sidebar-section-title" style={{ padding: "4px 10px 4px", marginBottom: 2 }}>
            企业登录
          </p>
          <a
            href={feishuLoginHref}
            className="sidebar-link"
            style={{ textDecoration: "none" }}
          >
            <span className="sidebar-link__icon">
              <FeishuIcon />
            </span>
            <span style={{ flex: 1 }}>一键飞书登录</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

function FeishuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.25 2.5H8.1C9.536 2.5 10.7 3.664 10.7 5.1V8.95C10.7 10.386 9.536 11.55 8.1 11.55H4.25V2.5ZM11.75 4.45H12.3C13.2941 4.45 14.1 5.25589 14.1 6.25V11.75C14.1 12.7441 13.2941 13.55 12.3 13.55H6.8C5.80589 13.55 5 12.7441 5 11.75V11.2H8.1C10.4537 11.2 12.35 9.30374 12.35 6.95V4.45H11.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2.75H3.75C3.19772 2.75 2.75 3.19772 2.75 3.75V12.25C2.75 12.8023 3.19772 13.25 3.75 13.25H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 5.25L12 8M12 8L9 10.75M12 8H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

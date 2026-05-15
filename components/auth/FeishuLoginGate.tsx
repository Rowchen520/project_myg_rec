"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function FeishuLoginGate({ active }: { active: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [redirecting, setRedirecting] = useState(false);
  const error = searchParams?.get("feishuLoginError") ?? undefined;

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("feishuLoginError");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname || "/";
  }, [pathname, searchParams]);

  const loginHref = `/api/auth/feishu/login?redirectTo=${encodeURIComponent(redirectTo || "/")}`;
  const detailHref = `/login?redirectTo=${encodeURIComponent(redirectTo || "/")}${error ? `&error=${encodeURIComponent(error)}` : ""}`;

  useEffect(() => {
    if (!active || error || redirecting) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRedirecting(true);
      window.location.assign(loginHref);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [active, error, loginHref, redirecting]);

  if (!active) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.58)",
        backdropFilter: "blur(6px)",
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <div
        className="surface"
        style={{
          width: "min(520px, 100%)",
          border: "1px solid var(--border-default)",
          background: "var(--bg-canvas)",
          boxShadow: "var(--shadow-large)"
        }}
      >
        <div className="surface__body" style={{ display: "grid", gap: 14, padding: 24 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <p className="sidebar-section-title" style={{ margin: 0 }}>企业登录</p>
            <h1 className="page-title" style={{ fontSize: 28, margin: 0 }}>请先使用飞书登录</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              未登录时无法继续使用当前页面。登录成功后会自动持久化会话，下次访问将直接恢复。
            </p>
          </div>

          {error ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(185, 28, 28, 0.24)",
                background: "rgba(254, 242, 242, 0.9)",
                padding: 14,
                color: "#991b1b"
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>登录失败</strong>
              <span>{error}</span>
            </div>
          ) : (
            <div className="hint" style={{ fontSize: 13 }}>
              {redirecting ? "正在跳转飞书授权页..." : "即将自动跳转到飞书授权页。"}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={loginHref} className="btn" data-variant="accent">
              立即登录
            </a>
            <Link href={detailHref} className="btn" data-variant="ghost">
              查看登录详情
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
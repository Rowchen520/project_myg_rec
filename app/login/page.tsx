import Link from "next/link";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const redirectTo = typeof params.redirectTo === "string" && params.redirectTo.startsWith("/")
    ? params.redirectTo
    : "/";
  const loginHref = `/api/auth/feishu/login?redirectTo=${encodeURIComponent(redirectTo)}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)"
      }}
    >
      <section className="surface" style={{ width: "min(560px, 100%)" }}>
        <div className="surface__body" style={{ display: "grid", gap: 16, padding: 28 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <p className="sidebar-section-title" style={{ margin: 0 }}>飞书登录</p>
            <h1 className="page-title" style={{ margin: 0 }}>登录项目工作台</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              使用飞书企业身份登录后，平台会持久化当前会话，后续访问无需重复授权。
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
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={loginHref} className="btn" data-variant="accent">
              使用飞书登录
            </a>
            <Link href={redirectTo} className="btn" data-variant="ghost">
              返回上一页
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Surface } from "@/components/primer/Surface";
import { getFeishuAccountOverview, completeFeishuProfile, unlinkFeishuAccount } from "@/feishu/account";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import { buildClearedSessionCookie } from "@/lib/services/session-cookie";

export const dynamic = "force-dynamic";

interface FeishuPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MyFeishuPage({ searchParams }: FeishuPageProps) {
  const params = await searchParams;
  const { currentUser } = await getShellRequestContext();
  if (!currentUser) {
    redirect("/my/page");
  }

  const viewer = currentUser;

  const { user, logs } = await getFeishuAccountOverview(viewer.id);
  const binding = user?.feishuBinding;
  const person = user?.person;
  const onboarding = params.onboarding === "1";
  const saved = params.saved === "1";

  async function completeProfileAction(formData: FormData) {
    "use server";
    await completeFeishuProfile(viewer.id, {
      displayName: String(formData.get("displayName") ?? "").trim() || viewer.name,
      personRole: String(formData.get("personRole") ?? "").trim() || "飞书成员",
      capacity: Number(formData.get("capacity") ?? person?.capacity ?? 100) || 100
    });
    redirect("/my/feishu?saved=1");
  }

  async function unlinkAction() {
    "use server";
    await unlinkFeishuAccount(viewer.id);
    const store = await cookies();
    store.set(buildClearedSessionCookie());
    redirect(`/my/page?feishuLoginError=${encodeURIComponent("飞书账号已解绑，请重新登录。")}`);
  }

  return (
    <>
      <Breadcrumb items={[{ label: "我的工作", href: "/my/page" }, { label: "飞书账号" }]} />

      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">飞书账号</h1>
          <p className="page-subtitle">查看当前绑定状态，完成首次资料补全，并查看最近的登录审计记录。</p>
        </div>
      </header>

      {onboarding ? (
        <Surface title="首次登录需要补全资料" description="请确认在平台中的展示名称、角色和默认工作容量。">
          <div className="hint">完成后会继续保持自动登录。</div>
        </Surface>
      ) : null}

      {saved ? (
        <Surface title="资料已更新" description="你的飞书资料补全已保存。">
          <div className="hint">后续登录将继续沿用当前补全后的资料。</div>
        </Surface>
      ) : null}

      <Surface
        title="绑定状态"
        description={binding ? "当前账号已绑定飞书身份。" : "当前账号尚未绑定飞书身份。"}
        actions={
          binding ? (
            <form action={unlinkAction}>
              <button className="btn" data-size="sm" data-variant="ghost" type="submit">
                解除绑定并退出
              </button>
            </form>
          ) : (
            <a href="/api/auth/feishu/login?redirectTo=%2Fmy%2Ffeishu" className="btn" data-size="sm" data-variant="accent">
              立即绑定飞书
            </a>
          )
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <Field label="平台用户">{viewer.name}</Field>
          <Field label="飞书显示名">{binding?.displayName ?? "未绑定"}</Field>
          <Field label="Open ID">{binding?.openId ?? "未绑定"}</Field>
          <Field label="Union ID">{binding?.unionId ?? "未返回"}</Field>
          <Field label="邮箱">{binding?.email ?? "未返回"}</Field>
          <Field label="手机号">{binding?.mobile ?? "未返回"}</Field>
          <Field label="最近登录">{binding?.lastLoginAt ? new Date(binding.lastLoginAt).toLocaleString("zh-CN") : "暂无"}</Field>
        </div>
      </Surface>

      {binding ? (
        <Surface title="资料补全" description="首次登录后建议确认这些基础字段，供工作台和通知展示复用。">
          <form action={completeProfileAction} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="hint">展示名称</span>
              <input className="input" name="displayName" defaultValue={binding.displayName || viewer.name} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="hint">岗位角色</span>
              <input className="input" name="personRole" defaultValue={person?.role ?? "飞书成员"} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="hint">默认容量</span>
              <input className="input" name="capacity" type="number" min={1} max={200} defaultValue={person?.capacity ?? 100} />
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" data-variant="accent" type="submit">
                保存资料
              </button>
              <span className="hint">
                {binding.profileCompletedAt
                  ? `已于 ${new Date(binding.profileCompletedAt).toLocaleString("zh-CN")} 完成资料补全`
                  : "尚未完成首次资料补全"}
              </span>
            </div>
          </form>
        </Surface>
      ) : null}

      <Surface title="登录审计" description="记录最近与当前账号相关的飞书登录、资料补全和解绑事件。" flush>
        {logs.length === 0 ? (
          <div style={{ padding: 16 }} className="hint">暂无审计记录。</div>
        ) : (
          <div className="scroll-x">
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>事件</th>
                  <th>结果</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString("zh-CN")}</td>
                    <td>{labelForEvent(log.event)}</td>
                    <td>{log.success ? "成功" : "失败"}</td>
                    <td>{log.message ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span className="hint">{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

function labelForEvent(event: string) {
  switch (event) {
    case "LOGIN_SUCCEEDED":
      return "登录成功";
    case "LOGIN_FAILED":
      return "登录失败";
    case "PROFILE_COMPLETED":
      return "资料补全";
    case "BINDING_REMOVED":
      return "解除绑定";
    default:
      return event;
  }
}
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PersonalAIBreakdown } from "@/components/ai/PersonalAIBreakdown";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function PersonalBreakdownPage() {
  const { currentUser } = await getShellRequestContext();
  const enabled = await isModuleEnabledForUser("personalAgentBreakdown", currentUser);
  if (!enabled) {
    redirect("/my/page");
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "我的工作", href: "/my/page" },
          { label: "AI 帮我拆解" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">AI 帮我拆解</h1>
          <p className="page-subtitle">
            个人版 AI 拆解默认写入我的工作台，不强制绑定项目。
          </p>
        </div>
      </header>
      <PersonalAIBreakdown currentUser={currentUser} />
    </>
  );
}

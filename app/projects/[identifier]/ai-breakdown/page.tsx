import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AIBreakdownWorkspace } from "@/components/ai/AIBreakdownWorkspace";
import { EmptyState } from "@/components/primer/EmptyState";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectAIBreakdownPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot, currentUser } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }
  if (!project.enabledModules.includes("ai_breakdown")) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "项目", href: "/projects" },
            { label: project.name, href: `/projects/${project.identifier}/overview` },
            { label: "AI 拆解" }
          ]}
        />
        <EmptyState
          title="该项目尚未启用 AI 拆解模块"
          description="可在「项目设置」勾选 AI 拆解后再访问。"
          action={
            <Link href={`/projects/${project.identifier}/settings`} className="btn" data-size="sm">
              打开项目设置
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "AI 拆解" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">AI 拆解工作区</h1>
          <p className="page-subtitle">
            通过自然语言描述目标，AI 会生成草稿；项目经理确认后写入正式工作项与风险。
          </p>
        </div>
      </header>
      <AIBreakdownWorkspace project={project} currentUser={currentUser} />
    </>
  );
}

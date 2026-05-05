import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Surface } from "@/components/primer/Surface";
import { ProjectSettingsForm } from "@/components/projects/ProjectSettingsForm";
import { can } from "@/lib/rbac";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { ProjectModule } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

const ALL_MODULES: ProjectModule[] = [
  "overview",
  "work_packages",
  "boards",
  "gantt",
  "members",
  "ai_diagnosis",
  "ai_breakdown",
  "settings"
];

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot, currentUser } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }
  if (!currentUser || !can(currentUser.role, "manageProjectModules")) {
    redirect(`/projects/${identifier}/overview`);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "设置" }
        ]}
      />
      <header className="page-header" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="page-header__meta">
          <h1 className="page-title">项目设置</h1>
          <p className="page-subtitle">调整项目元数据，启用或禁用模块。</p>
        </div>
      </header>
      <Surface>
        <ProjectSettingsForm
          project={project}
          parentCandidates={snapshot.projects}
          allModules={ALL_MODULES}
          currentUserId={currentUser.id}
        />
      </Surface>
    </div>
  );
}

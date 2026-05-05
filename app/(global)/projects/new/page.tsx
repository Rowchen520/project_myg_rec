import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Surface } from "@/components/primer/Surface";
import { ProjectCreateForm } from "@/components/projects/ProjectCreateForm";
import { can } from "@/lib/rbac";
import { getShellRequestContext } from "@/lib/services/shell-request-context";
import type { ProjectModule } from "@/lib/types";

export const dynamic = "force-dynamic";

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

const DEFAULT_MODULES: ProjectModule[] = [
  "overview",
  "work_packages",
  "boards",
  "gantt",
  "members",
  "settings"
];

export default async function NewProjectPage() {
  const { snapshot, currentUser } = await getShellRequestContext();

  if (!currentUser) {
    notFound();
  }
  if (!can(currentUser.role, "manageProjects")) {
    redirect("/projects");
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Breadcrumb items={[{ label: "项目", href: "/projects" }, { label: "新建项目" }]} />
      <header className="page-header" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="page-header__meta">
          <h1 className="page-title">新建项目</h1>
          <p className="page-subtitle">可选父项目以建立项目层级，并选择需要启用的模块。</p>
        </div>
      </header>
      <Surface>
        <ProjectCreateForm
          parentCandidates={snapshot.projects}
          defaultModules={DEFAULT_MODULES}
          allModules={ALL_MODULES}
          currentUserId={currentUser.id}
        />
      </Surface>
    </div>
  );
}

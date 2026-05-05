import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProjectWorkPackagesView } from "@/components/work-packages/ProjectWorkPackagesView";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectWorkPackagesPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot, currentUser } = await getShellRequestContext();

  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }

  const projectWorkPackages = snapshot.workPackages.filter((wp) => wp.projectId === project.id);
  const comments = snapshot.workPackageComments.filter((comment) =>
    projectWorkPackages.some((wp) => wp.id === comment.workPackageId)
  );
  const approvals = snapshot.workPackageApprovals.filter((approval) =>
    projectWorkPackages.some((wp) => wp.id === approval.workPackageId)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "工作项" }
        ]}
      />
      <ProjectWorkPackagesView
        project={project}
        workPackages={projectWorkPackages}
        comments={comments}
        approvals={approvals}
        people={snapshot.people}
        currentUser={currentUser}
      />
    </div>
  );
}

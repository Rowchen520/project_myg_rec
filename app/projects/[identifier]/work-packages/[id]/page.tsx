import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Surface } from "@/components/primer/Surface";
import { WorkPackageDetailPane } from "@/components/work-packages/WorkPackageDetailPane";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string; id: string }>;
}

export default async function WorkPackageDetailPage({ params }: PageProps) {
  const { identifier, id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    notFound();
  }

  const { snapshot, currentUser } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  const workPackage = snapshot.workPackages.find((wp) => wp.id === numericId);

  if (!project || !workPackage || workPackage.projectId !== project.id) {
    notFound();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          {
            label: "工作项",
            href: `/projects/${project.identifier}/work-packages`
          },
          { label: `#${workPackage.id}` }
        ]}
      />

      <Surface
        title="工作项详情"
        actions={
          <Link
            href={`/projects/${project.identifier}/work-packages`}
            className="btn"
            data-size="sm"
          >
            返回列表
          </Link>
        }
      >
        <WorkPackageDetailPane
          workPackage={workPackage}
          project={project}
          people={snapshot.people}
          comments={snapshot.workPackageComments}
          approvals={snapshot.workPackageApprovals}
          currentUser={currentUser}
        />
      </Surface>
    </div>
  );
}

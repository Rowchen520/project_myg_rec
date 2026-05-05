import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Surface } from "@/components/primer/Surface";
import { GanttChart } from "@/components/gantt/GanttChart";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ identifier: string }>;
}

export default async function ProjectGanttPage({ params }: PageProps) {
  const { identifier } = await params;
  const { snapshot } = await getShellRequestContext();
  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }

  const items = snapshot.workPackages.filter((wp) => wp.projectId === project.id);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "项目", href: "/projects" },
          { label: project.name, href: `/projects/${project.identifier}/overview` },
          { label: "甘特图" }
        ]}
      />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">甘特图</h1>
          <p className="page-subtitle">按开始和截止日期排布的时间线视图。</p>
        </div>
      </header>
      <Surface flush>
        <GanttChart workPackages={items} people={snapshot.people} now={new Date().toISOString()} />
      </Surface>
    </>
  );
}

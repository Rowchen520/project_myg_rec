import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface ProjectLayoutProps {
  params: Promise<{ identifier: string }>;
  children: ReactNode;
}

export default async function ProjectLayout({ params, children }: ProjectLayoutProps) {
  const { identifier } = await params;
  const { snapshot, currentUser, unreadNotificationCount } = await getShellRequestContext();

  const project = snapshot.projects.find((item) => item.identifier === identifier);
  if (!project) {
    notFound();
  }

  return (
    <AppShell
      projects={snapshot.projects}
      currentUser={currentUser}
      unreadNotificationCount={unreadNotificationCount}
      currentProjectIdentifier={identifier}
      sidebar={<ProjectSidebar project={project} />}
    >
      {children}
    </AppShell>
  );
}

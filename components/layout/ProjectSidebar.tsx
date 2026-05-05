"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AIBreakdownIcon,
  AIDiagnosisIcon,
  BoardsIcon,
  GanttIcon,
  MembersIcon,
  OverviewIcon,
  SettingsIcon,
  WorkPackagesIcon
} from "./sidebar-icons";
import type { ReactNode } from "react";
import type { Project, ProjectModule } from "@/lib/types";
import { projectStatusLabel, projectStatusTone } from "@/lib/work-package-presentation";
import { Badge } from "@/components/primer/Badge";

interface ProjectSidebarProps {
  project: Project;
}

interface ModuleNavItem {
  module: ProjectModule;
  href: (identifier: string) => string;
  label: string;
  icon: ReactNode;
  matches?: (pathname: string, identifier: string) => boolean;
}

const moduleItems: ModuleNavItem[] = [
  {
    module: "overview",
    href: (id) => `/projects/${id}/overview`,
    label: "概览",
    icon: <OverviewIcon />
  },
  {
    module: "work_packages",
    href: (id) => `/projects/${id}/work-packages`,
    label: "工作项",
    icon: <WorkPackagesIcon />,
    matches: (pathname, id) => pathname.startsWith(`/projects/${id}/work-packages`)
  },
  {
    module: "boards",
    href: (id) => `/projects/${id}/boards`,
    label: "看板",
    icon: <BoardsIcon />
  },
  {
    module: "gantt",
    href: (id) => `/projects/${id}/gantt`,
    label: "甘特图",
    icon: <GanttIcon />
  },
  {
    module: "members",
    href: (id) => `/projects/${id}/members`,
    label: "成员",
    icon: <MembersIcon />
  },
  {
    module: "ai_diagnosis",
    href: (id) => `/projects/${id}/ai-diagnosis`,
    label: "AI 诊断",
    icon: <AIDiagnosisIcon />
  },
  {
    module: "ai_breakdown",
    href: (id) => `/projects/${id}/ai-breakdown`,
    label: "AI 拆解",
    icon: <AIBreakdownIcon />
  },
  {
    module: "settings",
    href: (id) => `/projects/${id}/settings`,
    label: "项目设置",
    icon: <SettingsIcon />
  }
];

/**
 * Project-context sidebar. Items are filtered by `project.enabledModules`
 * to mirror OpenProject's per-project module toggles.
 */
export function ProjectSidebar({ project }: ProjectSidebarProps) {
  const pathname = usePathname();
  const enabled = new Set(project.enabledModules);

  return (
    <aside className="app-sidebar" aria-label={`${project.name} 模块导航`}>
      <div className="sidebar-project-card">
        <span className="sidebar-project-card__label">项目</span>
        <h2 className="sidebar-project-card__name">{project.name}</h2>
        <Badge tone={projectStatusTone(project.status)}>
          {projectStatusLabel(project.status)}
        </Badge>
      </div>
      <hr className="divider" />
      <div className="sidebar-section">
        <p className="sidebar-section-title">模块</p>
        <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {moduleItems.map((item) => {
            if (!enabled.has(item.module)) {
              return null;
            }
            const href = item.href(project.identifier);
            const isActive = item.matches
              ? item.matches(pathname, project.identifier)
              : pathname === href;
            return (
              <Link key={item.module} href={href} className="sidebar-link" data-active={isActive}>
                <span className="sidebar-link__icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

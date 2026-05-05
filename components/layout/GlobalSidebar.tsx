"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AdminIcon,
  LaunchIcon,
  MyWorkIcon,
  NotificationsIcon,
  OverviewIcon,
  ProjectsIcon,
  WorkPackagesIcon
} from "./sidebar-icons";
import type { PlatformFeatureFlagDto } from "@/lib/services/feature-flags";
import type { User } from "@/lib/types";
import type { ReactNode } from "react";

interface GlobalNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  flagKey?: PlatformFeatureFlagDto["key"];
  matches?: (pathname: string) => boolean;
}

const items: GlobalNavItem[] = [
  {
    href: "/launch",
    label: "启动",
    icon: <LaunchIcon />,
    flagKey: "launchPage",
    matches: (pathname) => pathname.startsWith("/launch")
  },
  {
    href: "/my/page",
    label: "我的工作",
    icon: <MyWorkIcon />,
    matches: (pathname) => pathname.startsWith("/my")
  },
  {
    href: "/overview",
    label: "平台总览",
    icon: <OverviewIcon />,
    flagKey: "platformOverview",
    matches: (pathname) => pathname.startsWith("/overview")
  },
  {
    href: "/projects",
    label: "项目",
    icon: <ProjectsIcon />,
    matches: (pathname) => pathname === "/projects" || pathname.startsWith("/projects/new")
  },
  {
    href: "/work-packages",
    label: "工作项",
    icon: <WorkPackagesIcon />,
    matches: (pathname) => pathname.startsWith("/work-packages")
  },
  {
    href: "/notifications",
    label: "通知中心",
    icon: <NotificationsIcon />,
    matches: (pathname) => pathname.startsWith("/notifications")
  },
  {
    href: "/admin",
    label: "管理员",
    icon: <AdminIcon />,
    matches: (pathname) => pathname.startsWith("/admin")
  }
];

/**
 * Global sidebar shown outside any project context. Mirrors OpenProject's
 * "global modules" menu surfaced from the grid icon.
 */
export function GlobalSidebar({
  flags = [],
  currentUser
}: {
  flags?: PlatformFeatureFlagDto[];
  currentUser?: User;
}) {
  const pathname = usePathname();
  const visibleItems = items.filter(
    (item) => !item.flagKey || isSidebarFlagEnabled(flags, item.flagKey, currentUser)
  );

  return (
    <aside className="app-sidebar" aria-label="全局模块">
      <div className="sidebar-section">
        <p className="sidebar-section-title">工作区</p>
        <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {visibleItems.map((item) => {
            const isActive = item.matches ? item.matches(pathname) : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-link"
                data-active={isActive}
              >
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

function isSidebarFlagEnabled(
  flags: PlatformFeatureFlagDto[],
  key: PlatformFeatureFlagDto["key"],
  user?: User
) {
  const flag = flags.find((item) => item.key === key);
  if (!flag?.siteEnabled) {
    return false;
  }

  return user ? flag.roleOverrides[user.role] ?? true : true;
}

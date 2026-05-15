import type { ReactNode } from "react";
import { FeishuLoginGate } from "@/components/auth/FeishuLoginGate";
import { AppHeader } from "./AppHeader";
import { UnreadNotificationAutoRefresh } from "./UnreadNotificationAutoRefresh";
import type { Project, User } from "@/lib/types";

interface AppShellProps {
  projects: Project[];
  currentUser?: User;
  unreadNotificationCount?: number;
  currentProjectIdentifier?: string;
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Top-level shell that lays out the OpenProject-style application:
 * sticky header with project switcher, sidebar (global or project-scoped,
 * decided by the caller), and the main content area constrained to a
 * comfortable max-width.
 */
export function AppShell({
  projects,
  currentUser,
  unreadNotificationCount = 0,
  currentProjectIdentifier,
  sidebar,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <UnreadNotificationAutoRefresh active={Boolean(currentUser)} />
      <AppHeader
        projects={projects}
        currentProjectIdentifier={currentProjectIdentifier}
        currentUser={currentUser}
        unreadNotificationCount={unreadNotificationCount}
      />
      <div className="app-body">
        {sidebar}
        <main className="app-content">
          <div className="app-content__inner fade-in">{children}</div>
        </main>
      </div>
      <FeishuLoginGate active={!currentUser} />
    </div>
  );
}

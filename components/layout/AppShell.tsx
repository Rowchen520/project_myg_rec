import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import type { Project, User } from "@/lib/types";

interface AppShellProps {
  projects: Project[];
  currentUser?: User;
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
  currentProjectIdentifier,
  sidebar,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <AppHeader
        projects={projects}
        currentProjectIdentifier={currentProjectIdentifier}
        currentUser={currentUser}
      />
      <div className="app-body">
        {sidebar}
        <main className="app-content">
          <div className="app-content__inner fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}

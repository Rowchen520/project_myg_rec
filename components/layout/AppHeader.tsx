import Link from "next/link";
import { Button } from "@/components/primer/Button";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { UserMenu } from "./UserMenu";
import type { Project, User } from "@/lib/types";

interface AppHeaderProps {
  projects: Project[];
  currentProjectIdentifier?: string;
  currentUser?: User;
  unreadNotificationCount?: number;
}

/**
 * Application top bar. Composition mirrors OpenProject 16.x: brand + project
 * switcher on the left, command/notification/profile cluster on the right.
 */
export function AppHeader({ projects, currentProjectIdentifier, currentUser, unreadNotificationCount = 0 }: AppHeaderProps) {
  return (
    <header className="app-header">
      <Link href="/" className="app-header__brand" aria-label="返回工作台首页">
        <span className="app-header__brand-mark" aria-hidden="true">
          PM
        </span>
        <span>Project Hub</span>
      </Link>
      <span className="app-header__divider" aria-hidden="true" />
      <ProjectSwitcher
        projects={projects}
        currentProjectIdentifier={currentProjectIdentifier}
      />

      <div className="app-header__spacer" />

      <button type="button" className="app-header__search" aria-label="全局搜索">
        <SearchIcon />
        <span style={{ flex: 1, textAlign: "left" }}>搜索工作项、项目、人员</span>
        <span className="kbd">⌘K</span>
      </button>

      <div className="app-header__actions">
        <Button
          variant="ghost"
          size="sm"
          data-icon-only="true"
          aria-label="新建"
          title="新建工作项 / 项目"
        >
          <PlusIcon />
        </Button>
        <Link
          href="/notifications"
          className="btn"
          data-variant="ghost"
          data-size="sm"
          data-icon-only="true"
          aria-label={unreadNotificationCount > 0 ? `通知中心，${unreadNotificationCount} 条未读消息` : "通知中心"}
          title="通知"
        >
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <BellIcon />
            {unreadNotificationCount > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: -7,
                  right: -10,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "#d1242f",
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: "16px",
                  textAlign: "center",
                  boxShadow: "0 0 0 2px var(--bg-default)"
                }}
              >
                {formatUnreadCount(unreadNotificationCount)}
              </span>
            ) : null}
          </span>
        </Link>
        <span className="app-header__divider" aria-hidden="true" style={{ marginLeft: 4, marginRight: 4 }} />
        <UserMenu currentUser={currentUser} />
      </div>
    </header>
  );
}

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.25 11.25L14 14M12.5 7.5C12.5 10.2614 10.2614 12.5 7.5 12.5C4.73858 12.5 2.5 10.2614 2.5 7.5C2.5 4.73858 4.73858 2.5 7.5 2.5C10.2614 2.5 12.5 4.73858 12.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 11C3.5 10 4 9 4 7.5C4 5.29086 5.79086 3.5 8 3.5C10.2091 3.5 12 5.29086 12 7.5C12 9 12.5 10 12.5 11H3.5ZM6.5 12.5H9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

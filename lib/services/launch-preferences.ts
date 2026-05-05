import { cookies } from "next/headers";
import type { Project } from "@/lib/types";

const LAST_PROJECT_COOKIE = "pm-last-selected-project";
const SKIP_LAUNCH_COOKIE = "pm-skip-launch";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export interface LaunchPreferences {
  lastSelectedProjectId?: string;
  skipLaunch: boolean;
}

/**
 * Reads launch routing preferences from browser cookies.
 */
export async function getLaunchPreferences(): Promise<LaunchPreferences> {
  const store = await cookies();
  return {
    lastSelectedProjectId: store.get(LAST_PROJECT_COOKIE)?.value,
    skipLaunch: store.get(SKIP_LAUNCH_COOKIE)?.value === "true"
  };
}

/**
 * Stores the last project selected from the launch page.
 */
export async function rememberSelectedProject(projectId: string) {
  const store = await cookies();
  store.set({
    name: LAST_PROJECT_COOKIE,
    value: projectId,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax"
  });
  store.delete(SKIP_LAUNCH_COOKIE);
}

/**
 * Stores whether the user explicitly skipped the launch screen.
 */
export async function rememberLaunchSkipped() {
  const store = await cookies();
  store.set({
    name: SKIP_LAUNCH_COOKIE,
    value: "true",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: false,
    sameSite: "lax"
  });
}

export function findRememberedProject(
  projects: Project[],
  preferences: LaunchPreferences
): Project | undefined {
  return projects.find((project) => project.id === preferences.lastSelectedProjectId);
}

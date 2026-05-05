import { redirect } from "next/navigation";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { findRememberedProject, getLaunchPreferences } from "@/lib/services/launch-preferences";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

/**
 * Root entry. The OpenProject-style layout pushes signed-in users into the
 * "My Page" workspace; the dedicated layout/components arrive in Phase 2/3.
 */
export default async function Home() {
  const { snapshot, currentUser } = await getShellRequestContext();
  const launchEnabled = await isModuleEnabledForUser("launchPage", currentUser);
  if (!launchEnabled) {
    redirect("/my/page");
  }

  const preferences = await getLaunchPreferences();
  if (preferences.skipLaunch) {
    redirect("/my/page");
  }

  const rememberedProject = findRememberedProject(snapshot.projects, preferences);
  if (rememberedProject) {
    redirect(`/projects/${rememberedProject.identifier}/overview`);
  }

  redirect("/launch");
}

import { redirect } from "next/navigation";
import { BigScreenLayout } from "@/components/big-screen/BigScreenLayout";
import { can } from "@/lib/rbac";
import { loadScreenPlan } from "@/lib/services/big-screen-plan";
import { isModuleEnabledForUser } from "@/lib/services/feature-flags";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ projectId?: string; token?: string; scenarioId?: string }>;
}

export default async function OverviewScreenPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { snapshot, currentUser } = await getShellRequestContext();
  const anonymousAllowed =
    params.token && params.token === (process.env.BIG_SCREEN_ANONYMOUS_TOKEN ?? "demo-big-screen");
  const enabled = currentUser ? await isModuleEnabledForUser("bigScreen", currentUser) : anonymousAllowed;

  if (!enabled || (!anonymousAllowed && currentUser && !can(currentUser.role, "viewBigScreen"))) {
    redirect("/overview");
  }

  const projectId = params.projectId ?? snapshot.projects[0]?.id ?? "proj-ai-pm";
  const initial = await loadScreenPlan({
    projectId,
    scenarioId: params.scenarioId,
    user: anonymousAllowed ? undefined : currentUser,
    anonymousFallback: Boolean(anonymousAllowed)
  });

  return (
    <BigScreenLayout
      projectId={projectId}
      initial={initial}
      token={anonymousAllowed ? params.token : undefined}
    />
  );
}

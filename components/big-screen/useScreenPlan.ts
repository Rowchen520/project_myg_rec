"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PlanBaselineSummary,
  PlanChangeInput,
  PlanModel,
  PlanScenarioSummary,
  ScreenPlanResponse
} from "@/lib/services/big-screen-plan";

interface UseScreenPlanOptions {
  projectId: string;
  scenarioId?: string;
  token?: string;
  initial: ScreenPlanResponse;
  pollMs?: number;
}

interface UseScreenPlanResult {
  plan: PlanModel;
  baseline: PlanModel | null;
  baselineSummary: PlanBaselineSummary | null;
  scenarios: PlanScenarioSummary[];
  activeScenario: PlanScenarioSummary | null;
  source: "scenario" | "baseline";
  /** Replace the in-memory plan immediately for optimistic UX. */
  setLocalPlan: (next: PlanModel) => void;
  /** Force a server refresh now. */
  refresh: () => Promise<void>;
  /** Indicates a polling refresh is currently in-flight. */
  refreshing: boolean;
  /** Persists the local plan to a draft scenario, creating one if needed. */
  commitDraft: (changes: PlanChangeInput[]) => Promise<PlanScenarioSummary | null>;
  /** Applies the active scenario back to the baseline. */
  applyActive: () => Promise<boolean>;
  /** True while a mutation is in flight. */
  saving: boolean;
}

/**
 * Manages the screen plan lifecycle: hydrate from SSR, poll, optimistic update.
 */
export function useScreenPlan(options: UseScreenPlanOptions): UseScreenPlanResult {
  const { projectId, scenarioId, token, initial, pollMs = 30_000 } = options;
  const [data, setData] = useState<ScreenPlanResponse>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const localOverrideRef = useRef<PlanModel | null>(null);
  const activeScenarioIdRef = useRef<string | null>(initial.activeScenario?.summary.id ?? null);

  const baseParams = useMemo(() => {
    const search = new URLSearchParams({ projectId });
    if (token) search.set("token", token);
    return search;
  }, [projectId, token]);

  const fetchPlan = useCallback(
    async (overrideScenarioId?: string) => {
      setRefreshing(true);
      try {
        const search = new URLSearchParams(baseParams);
        const targetScenario = overrideScenarioId ?? activeScenarioIdRef.current ?? scenarioId;
        if (targetScenario) search.set("scenarioId", targetScenario);
        const response = await fetch(`/api/overview/screen?${search.toString()}`, { cache: "no-store" });
        if (!response.ok) return;
        const next = (await response.json()) as ScreenPlanResponse;
        activeScenarioIdRef.current = next.activeScenario?.summary.id ?? null;
        setData(() => mergeServerSnapshot(next, localOverrideRef));
      } catch {
        // Polling failures are non-fatal; the previous snapshot remains visible.
      } finally {
        setRefreshing(false);
      }
    },
    [baseParams, scenarioId]
  );

  useEffect(() => {
    if (!pollMs) return;
    const timer = window.setInterval(() => {
      void fetchPlan();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [fetchPlan, pollMs]);

  const setLocalPlan = useCallback((next: PlanModel) => {
    localOverrideRef.current = next;
    setData((current) => ({ ...current, plan: next, source: current.activeScenario ? "scenario" : current.source }));
  }, []);

  const commitDraft = useCallback(
    async (changes: PlanChangeInput[]) => {
      setSaving(true);
      try {
        const tokenSearch = token ? `?token=${encodeURIComponent(token)}` : "";
        let scenarioForCommit = activeScenarioIdRef.current;
        if (!scenarioForCommit) {
          const created = await fetch(`/api/overview/screen/scenarios${tokenSearch}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId })
          });
          if (!created.ok) {
            const errorBody = await safeReadJson(created);
            throw new Error(errorBody?.message ?? `创建草稿失败 (${created.status})`);
          }
          const payload = (await created.json()) as { scenario: PlanScenarioSummary };
          scenarioForCommit = payload.scenario.id;
          activeScenarioIdRef.current = scenarioForCommit;
        }

        const planToSave = localOverrideRef.current ?? data.plan;
        const patch = await fetch(
          `/api/overview/screen/scenarios/${scenarioForCommit}${tokenSearch}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nextDraft: planToSave, changes })
          }
        );
        if (!patch.ok) {
          const errorBody = await safeReadJson(patch);
          throw new Error(errorBody?.message ?? `保存草稿失败 (${patch.status})`);
        }

        // Clear local override; the next fetch will return the authoritative draft.
        localOverrideRef.current = null;
        await fetchPlan(scenarioForCommit);
        return data.activeScenario?.summary ?? null;
      } finally {
        setSaving(false);
      }
    },
    [data.activeScenario, data.plan, fetchPlan, projectId, token]
  );

  const applyActive = useCallback(async () => {
    if (!activeScenarioIdRef.current) return false;
    setSaving(true);
    try {
      const response = await fetch(`/api/overview/screen/scenarios/${activeScenarioIdRef.current}/apply`, {
        method: "POST"
      });
      if (!response.ok) return false;
      activeScenarioIdRef.current = null;
      localOverrideRef.current = null;
      await fetchPlan();
      return true;
    } finally {
      setSaving(false);
    }
  }, [fetchPlan]);

  return {
    plan: data.plan,
    baseline: data.baseline?.plan ?? null,
    baselineSummary: data.baseline?.summary ?? null,
    scenarios: data.scenarios,
    activeScenario: data.activeScenario?.summary ?? null,
    source: data.source,
    setLocalPlan,
    refresh: fetchPlan,
    refreshing,
    commitDraft,
    applyActive,
    saving
  };
}

function mergeServerSnapshot(
  next: ScreenPlanResponse,
  localOverrideRef: React.MutableRefObject<PlanModel | null>
): ScreenPlanResponse {
  // If the user has a local override (mid-edit), keep their plan but adopt new metadata.
  const local = localOverrideRef.current;
  if (local) {
    return {
      ...next,
      plan: local
    };
  }
  return next;
}

async function safeReadJson(response: Response): Promise<{ message?: string } | null> {
  try {
    return (await response.json()) as { message?: string };
  } catch {
    return null;
  }
}

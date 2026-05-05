"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import { Textarea } from "@/components/primer/Textarea";
import type { Project, ProjectModule, ProjectStatus } from "@/lib/types";
import { ModuleToggles } from "./ProjectCreateForm";

interface ProjectSettingsFormProps {
  project: Project;
  parentCandidates: Project[];
  allModules: ProjectModule[];
  currentUserId?: string;
}

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "active", label: "进行中" },
  { value: "onHold", label: "暂停" },
  { value: "archived", label: "已归档" }
];

/**
 * Editable form rendered in /projects/[id]/settings. Keeps form state
 * locally and persists with PATCH /api/projects/[identifier].
 */
export function ProjectSettingsForm({
  project,
  parentCandidates,
  allModules,
  currentUserId
}: ProjectSettingsFormProps) {
  const router = useRouter();
  const [state, setState] = useState({
    name: project.name,
    description: project.description ?? "",
    parentId: project.parentId ?? "",
    status: project.status,
    enabledModules: new Set(project.enabledModules)
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function toggleModule(module: ProjectModule) {
    setState((current) => {
      const next = new Set(current.enabledModules);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return { ...current, enabledModules: next };
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(`/api/projects/${project.identifier}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(currentUserId ? { "x-user-id": currentUserId } : {})
        },
        body: JSON.stringify({
          name: state.name.trim(),
          description: state.description.trim() || null,
          parentId: state.parentId || null,
          status: state.status,
          enabledModules: Array.from(state.enabledModules)
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "保存项目设置失败");
      }
      setInfo("已保存");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存项目设置失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div>
        <label className="label" htmlFor="project-name">项目名称</label>
        <Input
          id="project-name"
          value={state.name}
          required
          onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
        />
      </div>

      <div>
        <label className="label" htmlFor="project-description">描述</label>
        <Textarea
          id="project-description"
          rows={3}
          value={state.description}
          onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label className="label" htmlFor="project-parent">父项目</label>
          <Select
            id="project-parent"
            value={state.parentId}
            onChange={(event) => setState((current) => ({ ...current, parentId: event.target.value }))}
          >
            <option value="">无（顶级项目）</option>
            {parentCandidates
              .filter((candidate) => candidate.id !== project.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </Select>
        </div>
        <div>
          <label className="label" htmlFor="project-status">状态</label>
          <Select
            id="project-status"
            value={state.status}
            onChange={(event) => setState((current) => ({ ...current, status: event.target.value as ProjectStatus }))}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <ModuleToggles
        allModules={allModules}
        enabled={Array.from(state.enabledModules)}
        onToggle={toggleModule}
      />

      {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}
      {info ? <p style={{ color: "var(--success-fg)", margin: 0, fontSize: 12 }}>{info}</p> : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "保存中…" : "保存设置"}
        </Button>
      </div>
    </form>
  );
}

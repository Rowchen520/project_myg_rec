"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import { Textarea } from "@/components/primer/Textarea";
import type { Project, ProjectModule, ProjectStatus } from "@/lib/types";
import { moduleLabel } from "@/lib/work-package-presentation";

interface ProjectCreateFormProps {
  parentCandidates: Project[];
  defaultModules: ProjectModule[];
  allModules: ProjectModule[];
  currentUserId?: string;
}

interface FormState {
  identifier: string;
  name: string;
  description: string;
  parentId: string;
  status: ProjectStatus;
  enabledModules: ProjectModule[];
}

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "active", label: "进行中" },
  { value: "onHold", label: "暂停" },
  { value: "archived", label: "已归档" }
];

/**
 * Inline create-project form rendered on /projects/new. Submits to the
 * server and redirects into the new project's overview on success.
 */
export function ProjectCreateForm({
  parentCandidates,
  defaultModules,
  allModules,
  currentUserId
}: ProjectCreateFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    identifier: "",
    name: "",
    description: "",
    parentId: "",
    status: "active",
    enabledModules: defaultModules
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function toggleModule(module: ProjectModule) {
    setState((current) => {
      const next = new Set(current.enabledModules);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return { ...current, enabledModules: Array.from(next) };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentUserId ? { "x-user-id": currentUserId } : {})
        },
        body: JSON.stringify({
          identifier: state.identifier.trim(),
          name: state.name.trim(),
          description: state.description.trim() || undefined,
          parentId: state.parentId || undefined,
          status: state.status,
          enabledModules: state.enabledModules
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "创建项目失败");
      }
      const payload = (await response.json()) as { project: Project };
      router.push(`/projects/${payload.project.identifier}/overview`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建项目失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="项目名称" htmlFor="project-name">
        <Input
          id="project-name"
          required
          value={state.name}
          placeholder="例如：客户成功平台"
          onChange={(event) => update("name", event.target.value)}
        />
      </Field>

      <Field
        label="项目标识符"
        htmlFor="project-identifier"
        hint="由小写字母、数字和短横线组成，作为 /projects/{identifier} URL。"
      >
        <Input
          id="project-identifier"
          required
          value={state.identifier}
          placeholder="例如：cs-platform"
          pattern="[a-z0-9][a-z0-9-]{1,40}"
          onChange={(event) => update("identifier", event.target.value.toLowerCase())}
        />
      </Field>

      <Field label="项目描述" htmlFor="project-description">
        <Textarea
          id="project-description"
          rows={3}
          value={state.description}
          placeholder="补充项目目标、范围或团队备注。"
          onChange={(event) => update("description", event.target.value)}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="父项目" htmlFor="project-parent">
          <Select
            id="project-parent"
            value={state.parentId}
            onChange={(event) => update("parentId", event.target.value)}
          >
            <option value="">无（顶级项目）</option>
            {parentCandidates.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="项目状态" htmlFor="project-status">
          <Select
            id="project-status"
            value={state.status}
            onChange={(event) => update("status", event.target.value as ProjectStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <ModuleToggles
        allModules={allModules}
        enabled={state.enabledModules}
        onToggle={toggleModule}
      />

      {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "创建中…" : "创建项目"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="hint" style={{ marginTop: 4, fontSize: 11 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ModuleToggles({
  allModules,
  enabled,
  onToggle
}: {
  allModules: ProjectModule[];
  enabled: ProjectModule[];
  onToggle: (module: ProjectModule) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="label">启用模块</span>
        <span className="hint" style={{ fontSize: 11 }}>
          已启用 {enabled.length} / {allModules.length}
        </span>
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 8, fontSize: 11 }}>
        勾选后会立即出现在项目侧边栏。Overview 是必选项。
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 8
        }}
      >
        {allModules.map((module) => {
          const checked = enabled.includes(module);
          return (
            <label
              key={module}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                border: `1px solid ${checked ? "var(--accent-fg)" : "var(--border-default)"}`,
                borderRadius: 8,
                background: checked ? "var(--accent-subtle)" : "var(--bg-canvas)",
                cursor: "pointer",
                transition: "background 0.1s ease, border-color 0.1s ease",
                fontSize: 13
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(module)}
                disabled={module === "overview"}
                style={{ accentColor: "var(--accent-fg)" }}
              />
              <span style={{ color: checked ? "var(--accent-emphasis)" : "var(--fg-default)" }}>
                {moduleLabel(module)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

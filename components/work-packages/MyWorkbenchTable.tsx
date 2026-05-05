"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Select } from "@/components/primer/Select";
import {
  getStatusTone,
  originLabel,
  originTone,
  statusLabel,
  typeLabel,
  typeTone
} from "@/lib/work-package-presentation";
import type { Project, User, WorkPackage } from "@/lib/types";

interface MyWorkbenchTableProps {
  currentUser?: User;
  workPackages: WorkPackage[];
  projects: Project[];
}

/**
 * Renders the unified My Workbench list: assigned work plus items created by me.
 */
export function MyWorkbenchTable({
  currentUser,
  workPackages,
  projects
}: MyWorkbenchTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetProjects, setTargetProjects] = useState<Record<number, string>>({});
  const projectLookup = new Map(projects.map((project) => [project.id, project]));

  async function deleteWorkPackage(workPackage: WorkPackage) {
    if (!currentUser || !confirm(`确认删除 #${workPackage.id} ${workPackage.subject}？`)) {
      return;
    }

    setBusyId(workPackage.id);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "DELETE",
        headers: { "x-user-id": currentUser.id }
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "删除失败。");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    } finally {
      setBusyId(null);
    }
  }

  async function attachToProject(workPackage: WorkPackage) {
    if (!currentUser) {
      return;
    }

    const nextProjectId = targetProjects[workPackage.id];
    if (!nextProjectId) {
      setError("请先选择要挂载的项目。");
      return;
    }

    setBusyId(workPackage.id);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({ projectId: nextProjectId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "挂载项目失败。");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "挂载项目失败。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}
      <div className="scroll-x">
        <table className="data-table" style={{ minWidth: 980 }}>
          <colgroup>
            <col style={{ width: 70 }} />
            <col style={{ width: 50 }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 260 }} />
          </colgroup>
          <thead>
            <tr>
              <th>类型</th>
              <th>ID</th>
              <th>主题</th>
              <th>状态</th>
              <th>项目</th>
              <th>来源</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {workPackages.map((wp) => {
              const project = wp.projectId ? projectLookup.get(wp.projectId) : undefined;
              const href = project
                ? `/projects/${project.identifier}/work-packages/${wp.id}`
                : `/work-packages?focus=${wp.id}`;
              const canDelete =
                currentUser && (currentUser.role === "admin" || wp.createdByUserId === currentUser.id);
              const canAttach =
                currentUser &&
                !wp.projectId &&
                (currentUser.role === "admin" || wp.createdByUserId === currentUser.id);
              return (
                <tr key={wp.id}>
                  <td>
                    <Badge tone={typeTone(wp.type)}>{typeLabel(wp.type)}</Badge>
                  </td>
                  <td className="hint mono">#{wp.id}</td>
                  <td>
                    <Link href={href} style={{ color: "var(--fg-default)", fontWeight: 500 }}>
                      {wp.subject}
                    </Link>
                  </td>
                  <td>
                    <Badge tone={getStatusTone(wp.status)}>{statusLabel(wp.status)}</Badge>
                  </td>
                  <td className="hint">
                    {project ? (
                      <Link href={`/projects/${project.identifier}/overview`}>{project.name}</Link>
                    ) : (
                      "个人事项"
                    )}
                  </td>
                  <td>
                    <Badge tone={originTone(wp.origin)}>{originLabel(wp.origin)}</Badge>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {canAttach ? (
                        <>
                          <Select
                            aria-label={`选择 #${wp.id} 要挂载的项目`}
                            value={targetProjects[wp.id] ?? ""}
                            onChange={(event) =>
                              setTargetProjects((current) => ({
                                ...current,
                                [wp.id]: event.target.value
                              }))
                            }
                            style={{ width: 130 }}
                          >
                            <option value="">挂到项目…</option>
                            {projects.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === wp.id || !targetProjects[wp.id]}
                            onClick={() => attachToProject(wp)}
                          >
                            挂载
                          </Button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === wp.id}
                          onClick={() => deleteWorkPackage(wp)}
                        >
                          删除
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

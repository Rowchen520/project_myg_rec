"use client";

import Link from "next/link";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import {
  getStatusTone,
  priorityLabel,
  priorityTone,
  statusLabel,
  typeLabel,
  typeTone
} from "@/lib/work-package-presentation";
import type { Person, Project, WorkPackage } from "@/lib/types";

interface WorkPackageTableProps {
  workPackages: WorkPackage[];
  projects: Project[];
  people: Person[];
  selectedId?: number;
  /** When provided, clicking a row selects it (split-screen view). */
  onSelect?: (workPackage: WorkPackage) => void;
  /**
   * When provided, the table emits links instead of selecting a row.
   * Used by the cross-project view to navigate into the project context.
   */
  hrefBuilder?: (workPackage: WorkPackage, project?: Project) => string;
}

/**
 * OpenProject-style work-package table with fixed column widths so badges
 * never wrap. Supports either row-selection or row-links.
 */
export function WorkPackageTable({
  workPackages,
  projects,
  people,
  selectedId,
  onSelect,
  hrefBuilder
}: WorkPackageTableProps) {
  if (workPackages.length === 0) {
    return (
      <EmptyState
        title="暂无工作项"
        description="尝试调整筛选条件，或在工作项列表创建新条目。"
      />
    );
  }

  const projectLookup = new Map(projects.map((project) => [project.id, project]));
  const personLookup = new Map(people.map((person) => [person.id, person]));
  const showProjectColumn = Boolean(hrefBuilder);

  return (
    <div className="surface" data-flush="true">
      <div className="scroll-x">
        <table className="data-table" style={{ minWidth: showProjectColumn ? 920 : 720 }}>
          <colgroup>
            <col style={{ width: 80 }} />
            <col style={{ width: 50 }} />
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 120 }} />
            {showProjectColumn ? <col style={{ width: 160 }} /> : null}
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr>
              <th>类型</th>
              <th>ID</th>
              <th>主题</th>
              <th>状态</th>
              <th>优先级</th>
              <th>负责人</th>
              {showProjectColumn ? <th>项目</th> : null}
              <th>截止</th>
            </tr>
          </thead>
          <tbody>
            {workPackages.map((wp) => {
              const project = wp.projectId ? projectLookup.get(wp.projectId) : undefined;
              const assignee = wp.assigneeId ? personLookup.get(wp.assigneeId) : undefined;
              const isSelected = selectedId === wp.id;
              const href = hrefBuilder ? hrefBuilder(wp, project) : undefined;
              const handleClick = onSelect ? () => onSelect(wp) : undefined;
              const isClickable = Boolean(handleClick || href);
              return (
                <tr
                  key={wp.id}
                  data-clickable={isClickable ? "true" : undefined}
                  data-selected={isSelected ? "true" : undefined}
                  onClick={handleClick}
                >
                  <td>
                    <Badge tone={typeTone(wp.type)}>{typeLabel(wp.type)}</Badge>
                  </td>
                  <td className="hint mono">#{wp.id}</td>
                  <td>
                    {href ? (
                      <Link
                        href={href}
                        style={{ color: "var(--fg-default)", fontWeight: 500 }}
                      >
                        {wp.subject}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 500 }}>{wp.subject}</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={getStatusTone(wp.status)}>{statusLabel(wp.status)}</Badge>
                  </td>
                  <td>
                    <Badge tone={priorityTone(wp.priority)}>{priorityLabel(wp.priority)}</Badge>
                  </td>
                  <td className="hint">
                    {assignee ? assignee.name : "—"}
                  </td>
                  {showProjectColumn ? (
                    <td className="hint">
                      {project ? (
                        <Link href={`/projects/${project.identifier}/overview`}>
                          {project.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  <td className="hint mono">
                    {wp.dueDate ? new Date(wp.dueDate).toISOString().slice(0, 10) : "—"}
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

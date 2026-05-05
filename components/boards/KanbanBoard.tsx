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

interface KanbanBoardProps {
  workPackages: WorkPackage[];
  project: Project;
  people: Person[];
  /** Status order shown as columns. */
  columns: string[];
}

/**
 * Status-grouped Kanban board for a single project. Columns maintain
 * minimum width and the row scrolls horizontally on narrow viewports.
 */
export function KanbanBoard({ workPackages, project, people, columns }: KanbanBoardProps) {
  if (workPackages.length === 0) {
    return <EmptyState title="项目暂无工作项" description="可在「工作项」模块新建第一项。" />;
  }

  const personLookup = new Map(people.map((person) => [person.id, person]));
  const grouped = new Map<string, WorkPackage[]>();
  for (const status of columns) {
    grouped.set(status, []);
  }
  for (const wp of workPackages) {
    const list = grouped.get(wp.status) ?? grouped.set(wp.status, []).get(wp.status)!;
    list.push(wp);
  }
  const allColumns = Array.from(grouped.keys());

  return (
    <div className="scroll-x" style={{ paddingBottom: 8 }}>
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "260px",
          gap: 12
        }}
      >
        {allColumns.map((status) => {
          const items = grouped.get(status) ?? [];
          return (
            <div
              key={status}
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-medium)",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 200
              }}
            >
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0 2px"
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Badge tone={getStatusTone(status)}>{statusLabel(status)}</Badge>
                </div>
                <span className="hint mono" style={{ fontSize: 11 }}>
                  {items.length}
                </span>
              </header>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {items.map((wp) => {
                  const assignee = wp.assigneeId ? personLookup.get(wp.assigneeId) : undefined;
                  return (
                    <li key={wp.id}>
                      <Link
                        href={`/projects/${project.identifier}/work-packages/${wp.id}`}
                        style={{
                          display: "block",
                          background: "var(--bg-canvas)",
                          border: "1px solid var(--border-default)",
                          borderRadius: 8,
                          padding: 10,
                          textDecoration: "none",
                          color: "var(--fg-default)",
                          transition: "border-color 0.1s ease, box-shadow 0.1s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 6 }}>
                          <Badge tone={typeTone(wp.type)}>{typeLabel(wp.type)}</Badge>
                          <Badge tone={priorityTone(wp.priority)}>{priorityLabel(wp.priority)}</Badge>
                        </div>
                        <strong style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                          <span className="mono hint" style={{ fontSize: 11, marginRight: 4 }}>#{wp.id}</span>
                          {wp.subject}
                        </strong>
                        {wp.lastProgressNote ? (
                          <p className="hint" style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5 }}>
                            {wp.lastProgressNote}
                          </p>
                        ) : null}
                        <p className="hint" style={{ margin: "8px 0 0", fontSize: 11, display: "flex", justifyContent: "space-between" }}>
                          <span>{assignee ? assignee.name : "未分配"}</span>
                          <span className="mono">{wp.percentComplete}%</span>
                        </p>
                      </Link>
                    </li>
                  );
                })}
                {items.length === 0 ? (
                  <li
                    className="hint"
                    style={{
                      padding: "12px 10px",
                      textAlign: "center",
                      fontSize: 12,
                      border: "1px dashed var(--border-default)",
                      borderRadius: 8
                    }}
                  >
                    暂无
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

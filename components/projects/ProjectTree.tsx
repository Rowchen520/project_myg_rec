"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { EmptyState } from "@/components/primer/EmptyState";
import { projectStatusLabel, projectStatusTone } from "@/lib/work-package-presentation";
import type { Project } from "@/lib/types";

interface ProjectTreeProps {
  projects: Project[];
}

interface ProjectTreeNode {
  project: Project;
  depth: number;
}

function buildHierarchy(projects: Project[]): ProjectTreeNode[] {
  const childrenByParent = new Map<string | undefined, Project[]>();
  for (const project of projects) {
    const parent = project.parentId;
    const list = childrenByParent.get(parent) ?? [];
    list.push(project);
    childrenByParent.set(parent, list);
  }

  const order: ProjectTreeNode[] = [];
  function walk(parentId: string | undefined, depth: number) {
    const items = (childrenByParent.get(parentId) ?? []).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    for (const project of items) {
      order.push({ project, depth });
      walk(project.id, depth + 1);
    }
  }
  walk(undefined, 0);
  return order;
}

/**
 * Renders projects as a hierarchical table. Subprojects are indented inline
 * with a connector glyph. Each row is fully clickable.
 */
export function ProjectTree({ projects }: ProjectTreeProps) {
  const router = useRouter();
  const nodes = buildHierarchy(projects);

  if (nodes.length === 0) {
    return <EmptyState title="暂无项目" description="尝试创建你的第一个项目。" />;
  }

  return (
    <div className="scroll-x">
      <table className="data-table" style={{ minWidth: 600 }}>
        <colgroup>
          <col />
          <col style={{ width: 100 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr>
            <th>项目</th>
            <th>状态</th>
            <th>健康度</th>
            <th>进度</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {nodes.map(({ project, depth }) => (
            <tr
              key={project.id}
              data-clickable="true"
              onClick={(event) => {
                if (event.target instanceof HTMLAnchorElement) return;
                router.push(`/projects/${project.identifier}/overview`);
              }}
            >
              <td>
                <div
                  style={{
                    paddingLeft: depth * 18,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  {depth > 0 ? (
                    <span aria-hidden="true" style={{ color: "var(--fg-subtle)" }}>↳</span>
                  ) : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <Link
                      href={`/projects/${project.identifier}/overview`}
                      style={{
                        fontWeight: 500,
                        color: "var(--fg-default)",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {project.name}
                    </Link>
                    <span className="hint mono" style={{ fontSize: 11 }}>
                      {project.identifier}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <Badge tone={projectStatusTone(project.status)}>
                  {projectStatusLabel(project.status)}
                </Badge>
              </td>
              <td>
                <Badge
                  tone={
                    project.health === "High"
                      ? "danger"
                      : project.health === "Medium"
                        ? "attention"
                        : "success"
                  }
                >
                  {project.health}
                </Badge>
              </td>
              <td>
                <ProgressBar value={project.progress} />
              </td>
              <td style={{ textAlign: "right" }}>
                <Link
                  href={`/projects/${project.identifier}/overview`}
                  className="btn"
                  data-size="sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  打开
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: "var(--bg-emphasis)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: "100%",
            background: "var(--accent-fg)",
            transition: "width 0.2s ease"
          }}
        />
      </div>
      <span className="hint mono" style={{ minWidth: 36, textAlign: "right", fontSize: 11 }}>
        {clamped}%
      </span>
    </div>
  );
}

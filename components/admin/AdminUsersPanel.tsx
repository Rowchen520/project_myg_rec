"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/primer/Input";
import type { SimplifiedDepartmentNode } from "@/feishu/department_id";
import { roleLabels } from "@/lib/rbac";
import type { FeishuDepartmentTreeSnapshotDto } from "@/lib/services/feishu-department-tree";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Surface } from "@/components/primer/Surface";
import type { FeishuDepartmentSyncOption } from "@/lib/services/feishu-department-tree";

interface AdminUsersPanelProps {
  departmentTreeSnapshot: FeishuDepartmentTreeSnapshotDto;
}

const PLATFORM_ROLES = ["admin", "projectManager", "participant"] as const;
const USER_PANEL_VIEWS = ["roles", "tree"] as const;

interface DepartmentSyncOptionNode extends FeishuDepartmentSyncOption {
  children: DepartmentSyncOptionNode[];
}

export function AdminUsersPanel({ departmentTreeSnapshot }: AdminUsersPanelProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(departmentTreeSnapshot);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingSyncSettings, setIsSavingSyncSettings] = useState(false);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [excludedDepartmentIdsDraft, setExcludedDepartmentIdsDraft] = useState(departmentTreeSnapshot.excludedDepartmentIds);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<(typeof USER_PANEL_VIEWS)[number]>("roles");
  const [query, setQuery] = useState("");
  const filteredTree = filterDepartmentTree(snapshot.tree, query.trim().toLowerCase());
  const syncOptionTree = buildDepartmentSyncOptionTree(snapshot.availableDepartments);

  async function syncDepartmentTree() {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/feishu/departments", {
        method: "POST"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "同步部门树失败。");
      }

      const payload = (await response.json()) as FeishuDepartmentTreeSnapshotDto;
      setSnapshot(payload);
      setExcludedDepartmentIdsDraft(payload.excludedDepartmentIds);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "同步部门树失败。");
    } finally {
      setIsSyncing(false);
    }
  }

  async function saveSyncSettings() {
    setIsSavingSyncSettings(true);
    setError(null);
    try {
      const response = await fetch("/api/feishu/departments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          excludedDepartmentIds: excludedDepartmentIdsDraft
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "保存同步设置失败。");
      }

      const payload = (await response.json()) as FeishuDepartmentTreeSnapshotDto;
      setSnapshot(payload);
      setExcludedDepartmentIdsDraft(payload.excludedDepartmentIds);
      setIsSyncSettingsOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存同步设置失败。");
    } finally {
      setIsSavingSyncSettings(false);
    }
  }

  function toggleExcludedDepartment(openDepartmentId: string) {
    setExcludedDepartmentIdsDraft((current) =>
      current.includes(openDepartmentId)
        ? current.filter((item) => item !== openDepartmentId)
        : [...current, openDepartmentId]
    );
  }

  return (
    <Surface title="用户" description="在同一板块中切换查看权限角色与部门树。" flush>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            size="sm"
            variant={activeView === "roles" ? "primary" : "ghost"}
            onClick={() => setActiveView("roles")}
          >
            权限角色
          </Button>
          <Button
            size="sm"
            variant={activeView === "tree" ? "primary" : "ghost"}
            onClick={() => setActiveView("tree")}
          >
            部门树
          </Button>
        </div>

        {activeView === "roles" ? (
          <div style={{ display: "grid", gap: 10 }}>
            {PLATFORM_ROLES.map((role) => (
              <div
                key={role}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  border: "1px solid var(--border-default)",
                  borderRadius: 12
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ fontSize: 13 }}>{roleLabels[role]}</strong>
                  <span className="hint" style={{ fontSize: 12 }}>{describeRole(role)}</span>
                </div>
                <Badge tone={roleTone(role)}>{roleLabels[role]}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="default">部门 {snapshot.departmentCount}</Badge>
                <Badge tone="accent">成员 {snapshot.userCount}</Badge>
                <Badge tone={snapshot.excludedDepartmentIds.length ? "attention" : "default"}>
                  已屏蔽 {snapshot.excludedDepartmentIds.length}
                </Badge>
                <span className="hint" style={{ fontSize: 12 }}>
                  {snapshot.syncedAt
                    ? `上次同步：${new Date(snapshot.syncedAt).toLocaleString("zh-CN")}`
                    : "尚未同步部门树。"}
                </span>
              </div>
              <div style={{ display: "grid", gap: 8, justifyItems: "stretch" }}>
                <Button size="sm" variant="primary" disabled={isSyncing} onClick={syncDepartmentTree}>
                  {isSyncing ? "同步中..." : "同步部门树"}
                </Button>
                <Button size="sm" variant="ghost" disabled={isSavingSyncSettings} onClick={() => setIsSyncSettingsOpen((current) => !current)}>
                  {isSyncSettingsOpen ? "收起同步设置" : "同步设置"}
                </Button>
              </div>
            </div>

            {isSyncSettingsOpen ? (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 12,
                  border: "1px solid var(--border-default)",
                  borderRadius: 12,
                  background: "var(--surface-subtle)"
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ fontSize: 13 }}>下次同步屏蔽部门</strong>
                  <span className="hint" style={{ fontSize: 12 }}>
                    勾选后，下次点击“同步部门树”时将跳过这些部门及其子部门；当前缓存不会立刻被清空。
                  </span>
                </div>

                {snapshot.availableDepartments.length ? (
                  <div style={{ display: "grid", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                    {syncOptionTree.map((department) => (
                      <DepartmentSyncSettingNode
                        key={department.openDepartmentId}
                        node={department}
                        depth={0}
                        excludedDepartmentIds={excludedDepartmentIdsDraft}
                        onToggle={toggleExcludedDepartment}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="hint" style={{ margin: 0, fontSize: 12 }}>
                    还没有可配置的部门列表。请先同步一次部门树，再设置屏蔽部门。
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSavingSyncSettings || !excludedDepartmentIdsDraft.length}
                    onClick={() => setExcludedDepartmentIdsDraft([])}
                  >
                    清空屏蔽
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isSavingSyncSettings}
                    onClick={saveSyncSettings}
                  >
                    {isSavingSyncSettings ? "保存中..." : "保存同步设置"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div>
              <label className="label">搜索部门树</label>
              <Input
                value={query}
                placeholder="按部门名、负责人或成员搜索"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            {error ? <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p> : null}

            {filteredTree.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {filteredTree.map((node, index) => (
                  <DepartmentNodeCard
                    key={`${node.department_name}-${index}`}
                    node={node}
                    depth={0}
                    forceOpen={Boolean(query.trim())}
                  />
                ))}
              </div>
            ) : (
              <p className="hint" style={{ margin: 0, fontSize: 12 }}>
                {snapshot.tree.length ? "没有匹配的部门或成员。" : "暂无缓存的部门树数据。"}
              </p>
            )}
          </div>
        )}
      </div>
    </Surface>
  );
}

function describeRole(role: typeof PLATFORM_ROLES[number]) {
  switch (role) {
    case "admin":
      return "负责平台级配置、治理与管理入口。";
    case "projectManager":
      return "负责项目管理、协调与执行推进。";
    case "participant":
      return "负责承接任务、更新进展与协作反馈。";
  }
}

function roleTone(role: typeof PLATFORM_ROLES[number]): "danger" | "accent" | "default" {
  switch (role) {
    case "admin":
      return "danger";
    case "projectManager":
      return "accent";
    case "participant":
      return "default";
  }
}

function DepartmentNodeCard({
  node,
  depth,
  forceOpen = false
}: {
  node: SimplifiedDepartmentNode;
  depth: number;
  forceOpen?: boolean;
}) {
  const detailsProps = forceOpen ? { open: true } : { defaultOpen: depth === 0 };

  return (
    <details
      {...detailsProps}
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: 12,
        marginLeft: depth * 16,
        background: depth === 0 ? "var(--surface-default)" : "var(--surface-subtle)"
      }}
    >
      <summary
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          cursor: "pointer",
          listStyle: "none"
        }}
      >
        <strong style={{ fontSize: 13 }}>{node.department_name || "未命名部门"}</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge tone="default">负责人 {node.leaders.length}</Badge>
          <Badge tone="accent">成员 {node.users.length}</Badge>
          <Badge tone="success">子部门 {node.children.length}</Badge>
        </div>
      </summary>

      {node.leaders.length ? (
        <p className="hint" style={{ margin: "8px 0 0", fontSize: 12 }}>
          负责人：{node.leaders.map((leader) => leader.name || leader.open_id).join("、")}
        </p>
      ) : null}

      {node.users.length ? (
        <p className="hint" style={{ margin: "6px 0 0", fontSize: 12 }}>
          成员：{node.users.map((user) => user.name || user.open_id).join("、")}
        </p>
      ) : (
        <p className="hint" style={{ margin: "6px 0 0", fontSize: 12 }}>暂无直属成员</p>
      )}

      {node.children.length ? (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {node.children.map((child, index) => (
            <DepartmentNodeCard
              key={`${child.department_name}-${depth + 1}-${index}`}
              node={child}
              depth={depth + 1}
              forceOpen={forceOpen}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function filterDepartmentTree(nodes: SimplifiedDepartmentNode[], query: string): SimplifiedDepartmentNode[] {
  if (!query) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterDepartmentTree(node.children, query);
    const matchesDepartment = node.department_name.toLowerCase().includes(query);
    const matchesLeader = node.leaders.some((leader) => matchUserLike(leader, query));
    const matchesUser = node.users.some((user) => matchUserLike(user, query));

    if (!matchesDepartment && !matchesLeader && !matchesUser && !filteredChildren.length) {
      return [];
    }

    return [{
      ...node,
      children: filteredChildren
    }];
  });
}

function matchUserLike(
  user: Pick<SimplifiedDepartmentNode["users"][number], "name" | "open_id" | "email" | "mobile" | "job_title">,
  query: string
) {
  return [user.name, user.open_id, user.email, user.mobile, user.job_title]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query));
}

function buildDepartmentSyncOptionTree(options: FeishuDepartmentSyncOption[]): DepartmentSyncOptionNode[] {
  const nodeById = new Map<string, DepartmentSyncOptionNode>();
  const roots: DepartmentSyncOptionNode[] = [];

  for (const option of options) {
    nodeById.set(option.openDepartmentId, {
      ...option,
      children: []
    });
  }

  for (const option of options) {
    const current = nodeById.get(option.openDepartmentId);
    if (!current) {
      continue;
    }

    if (option.parentOpenDepartmentId) {
      const parent = nodeById.get(option.parentOpenDepartmentId);
      if (parent) {
        parent.children.push(current);
        continue;
      }
    }

    roots.push(current);
  }

  const sortNodes = (nodes: DepartmentSyncOptionNode[]) => {
    nodes.sort((left, right) => left.departmentName.localeCompare(right.departmentName, "zh-CN"));
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

function DepartmentSyncSettingNode({
  node,
  depth,
  excludedDepartmentIds,
  onToggle
}: {
  node: DepartmentSyncOptionNode;
  depth: number;
  excludedDepartmentIds: string[];
  onToggle: (openDepartmentId: string) => void;
}) {
  const checked = excludedDepartmentIds.includes(node.openDepartmentId);
  const detailsProps = depth === 0 ? { defaultOpen: true } : undefined;

  return (
    <details
      {...detailsProps}
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        padding: 8,
        marginLeft: depth * 16,
        background: checked ? "var(--surface-default)" : depth === 0 ? "var(--surface-default)" : "transparent"
      }}
    >
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          listStyle: "none",
          flexWrap: "wrap"
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(node.openDepartmentId)}
          onClick={(event) => event.stopPropagation()}
        />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{node.departmentName}</span>
        <span className="hint" style={{ fontSize: 11, marginLeft: "auto" }}>{node.openDepartmentId}</span>
      </summary>

      {node.children.length ? (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {node.children.map((child) => (
            <DepartmentSyncSettingNode
              key={child.openDepartmentId}
              node={child}
              depth={depth + 1}
              excludedDepartmentIds={excludedDepartmentIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}
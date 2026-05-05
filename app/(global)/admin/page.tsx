import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Badge } from "@/components/primer/Badge";
import { Surface } from "@/components/primer/Surface";
import { permissionMatrix, roleLabels } from "@/lib/rbac";
import { getShellRequestContext } from "@/lib/services/shell-request-context";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { snapshot, currentUser } = await getShellRequestContext();

  const isAdmin = currentUser?.role === "admin";

  return (
    <>
      <Breadcrumb items={[{ label: "管理员" }]} />
      <header className="page-header">
        <div className="page-header__meta">
          <h1 className="page-title">管理员</h1>
          <p className="page-subtitle">
            {isAdmin
              ? "管理项目、用户与平台范围设置。"
              : "仅平台管理员可访问完整管理能力，下面以只读视角呈现。"}
          </p>
        </div>
        {isAdmin ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/feature-flags" className="btn" data-size="sm" data-variant="primary">
              平台模块开关
            </Link>
            <Link href="/admin/agent-keys" className="btn" data-size="sm">
              Agent Key
            </Link>
            <Link href="/admin/agent-audit" className="btn" data-size="sm">
              Agent 审计
            </Link>
          </div>
        ) : null}
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16
        }}
      >
        <Surface
          title={`项目 (${snapshot.projects.length})`}
          description="管理项目层级、模块开关与归档。"
          flush
        >
          <table className="data-table">
            <colgroup>
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 60 }} />
            </colgroup>
            <tbody>
              {snapshot.projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {project.parentId ? (
                        <span aria-hidden="true" style={{ color: "var(--fg-subtle)" }}>↳</span>
                      ) : null}
                      <Link
                        href={`/projects/${project.identifier}/overview`}
                        style={{ color: "var(--fg-default)", fontWeight: 500 }}
                      >
                        {project.name}
                      </Link>
                    </div>
                    <div className="hint mono" style={{ fontSize: 11, marginTop: 2 }}>
                      {project.identifier}
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={
                        project.status === "active"
                          ? "success"
                          : project.status === "onHold"
                            ? "attention"
                            : "default"
                      }
                    >
                      {project.status === "active"
                        ? "进行中"
                        : project.status === "onHold"
                          ? "暂停"
                          : "已归档"}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/projects/${project.identifier}/settings`}
                      className="btn"
                      data-size="sm"
                      data-variant="ghost"
                    >
                      设置
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>

        <Surface
          title={`用户 (${snapshot.users.length})`}
          description="平台账号和默认角色。"
          flush
        >
          <table className="data-table">
            <colgroup>
              <col />
              <col style={{ width: 120 }} />
            </colgroup>
            <tbody>
              {snapshot.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong style={{ fontSize: 13 }}>{user.name}</strong>
                    <p className="hint mono" style={{ margin: "2px 0 0", fontSize: 11 }}>
                      {user.id}
                    </p>
                  </td>
                  <td>
                    <Badge
                      tone={
                        user.role === "admin"
                          ? "danger"
                          : user.role === "projectManager"
                            ? "accent"
                            : "default"
                      }
                    >
                      {roleLabels[user.role]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </div>

      <Surface
        title="角色权限矩阵"
        description="不同角色可执行的操作。"
        flush
      >
        <div className="scroll-x">
          <table className="data-table" style={{ minWidth: 720 }}>
            <colgroup>
              <col />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr>
                <th>权限</th>
                <th style={{ textAlign: "center" }}>管理员</th>
                <th style={{ textAlign: "center" }}>项目经理</th>
                <th style={{ textAlign: "center" }}>参与员</th>
              </tr>
            </thead>
            <tbody>
              {permissionMatrix.map((permission) => (
                <tr key={permission.key}>
                  <td>{permission.label}</td>
                  <td style={{ textAlign: "center" }}>
                    {permission.admin ? <CheckMark /> : <Dash />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {permission.projectManager ? <CheckMark /> : <Dash />}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {permission.participant ? <CheckMark /> : <Dash />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </>
  );
}

function CheckMark() {
  return (
    <span style={{ color: "var(--success-fg)", fontWeight: 600 }} aria-label="允许">
      ✓
    </span>
  );
}

function Dash() {
  return (
    <span style={{ color: "var(--fg-subtle)" }} aria-label="不允许">
      —
    </span>
  );
}

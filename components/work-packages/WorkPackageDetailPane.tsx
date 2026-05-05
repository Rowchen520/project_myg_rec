"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Select } from "@/components/primer/Select";
import { Textarea } from "@/components/primer/Textarea";
import { Input } from "@/components/primer/Input";
import { can } from "@/lib/rbac";
import {
  getStatusTone,
  priorityLabel,
  priorityTone,
  riskLevelTone,
  statusLabel,
  typeLabel,
  typeTone
} from "@/lib/work-package-presentation";
import type {
  Person,
  Project,
  User,
  WorkPackage,
  WorkPackageApproval,
  WorkPackageApprovalStatus,
  WorkPackageComment,
  WorkPackageStatus
} from "@/lib/types";

interface WorkPackageDetailPaneProps {
  workPackage: WorkPackage;
  project: Project;
  people: Person[];
  comments: WorkPackageComment[];
  approvals: WorkPackageApproval[];
  currentUser?: User;
  onClose?: () => void;
}

const STATUS_BY_TYPE: Record<string, WorkPackageStatus[]> = {
  task: ["todo", "inProgress", "review", "done", "blocked"],
  milestone: ["planned", "achieved", "atRisk"],
  risk: ["open", "mitigating", "closed"],
  phase: ["planned", "active", "completed"]
};

/**
 * Right-side detail pane with three logical groups: meta, progress edit,
 * and collaboration timeline (comments + approvals). Updates round-trip to
 * the server through the `/api/work-packages` endpoints.
 */
export function WorkPackageDetailPane({
  workPackage,
  project,
  people,
  comments,
  approvals,
  currentUser,
  onClose
}: WorkPackageDetailPaneProps) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    status: workPackage.status,
    percentComplete: workPackage.percentComplete,
    assigneeId: workPackage.assigneeId ?? "",
    lastProgressNote: workPackage.lastProgressNote
  });
  const [commentBody, setCommentBody] = useState("");
  const [commentType, setCommentType] = useState<WorkPackageComment["type"]>("comment");
  const [approvalComment, setApprovalComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const wpComments = comments
    .filter((comment) => comment.workPackageId === workPackage.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const wpApprovals = approvals
    .filter((approval) => approval.workPackageId === workPackage.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const canUpdate =
    currentUser &&
    (currentUser.role === "admin" ||
      currentUser.role === "projectManager" ||
      workPackage.assigneeId === currentUser.personId);
  const canApprove = currentUser ? can(currentUser.role, "approveWorkPackages") : false;
  const personLookup = new Map(people.map((person) => [person.id, person]));
  const statusOptions = STATUS_BY_TYPE[workPackage.type] ?? STATUS_BY_TYPE.task;

  async function saveProgress() {
    if (!currentUser) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({
          status: draft.status,
          percentComplete: Number(draft.percentComplete),
          lastProgressNote: draft.lastProgressNote,
          assigneeId: draft.assigneeId || undefined
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "更新失败");
      }
      setInfo("已保存进展");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }

  async function postComment() {
    if (!currentUser || !commentBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ body: commentBody.trim(), type: commentType })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "评论失败");
      }
      setCommentBody("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评论失败");
    } finally {
      setBusy(false);
    }
  }

  async function approve(status: Exclude<WorkPackageApprovalStatus, "pending">) {
    if (!currentUser) return;
    const comment = approvalComment.trim() || (status === "approved" ? "已批准" : "需要补充信息");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-packages/${workPackage.id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": currentUser.id },
        body: JSON.stringify({ status, comment })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "签核失败");
      }
      setApprovalComment("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "签核失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface fade-in">
      <header className="surface__header">
        <div className="surface__header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Badge tone={typeTone(workPackage.type)}>{typeLabel(workPackage.type)}</Badge>
            <span className="hint mono">#{workPackage.id}</span>
            <Badge tone={getStatusTone(workPackage.status)}>{statusLabel(workPackage.status)}</Badge>
            <Badge tone={priorityTone(workPackage.priority)}>{priorityLabel(workPackage.priority)}</Badge>
            {workPackage.riskLevel ? (
              <Badge tone={riskLevelTone(workPackage.riskLevel)}>风险 {workPackage.riskLevel}</Badge>
            ) : null}
          </div>
          <h2
            className="section-title"
            style={{ fontSize: 16, marginTop: 6, lineHeight: 1.4 }}
          >
            {workPackage.subject}
          </h2>
        </div>
        <div style={{ display: "inline-flex", gap: 4 }}>
          <Link
            href={`/projects/${project.identifier}/work-packages/${workPackage.id}`}
            className="btn"
            data-variant="ghost"
            data-size="sm"
            data-icon-only="true"
            aria-label="打开全屏视图"
            title="打开全屏视图"
          >
            <ExternalIcon />
          </Link>
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              data-icon-only="true"
              onClick={onClose}
              aria-label="关闭详情面板"
              title="关闭"
            >
              <CloseIcon />
            </Button>
          ) : null}
        </div>
      </header>
      <div className="surface__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {workPackage.description ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--fg-default)" }}>
            {workPackage.description}
          </p>
        ) : null}

        {workPackage.type === "risk" ? (
          <div className="muted-card" style={{ padding: 12 }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>影响</p>
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>{workPackage.riskImpact ?? "—"}</p>
            <p className="eyebrow" style={{ marginBottom: 4 }}>缓解建议</p>
            <p style={{ margin: 0, fontSize: 13 }}>{workPackage.riskMitigation ?? "—"}</p>
          </div>
        ) : null}

        <Section title="进展更新">
          <fieldset
            disabled={!canUpdate || busy}
            style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="状态">
                <Select
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as WorkPackageStatus }))}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="完成度 (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.percentComplete}
                  onChange={(event) => setDraft((current) => ({ ...current, percentComplete: Number(event.target.value) }))}
                />
              </Field>
            </div>
            <Field label="负责人">
              <Select
                value={draft.assigneeId}
                onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))}
              >
                <option value="">未分配</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.role}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="最新进展备注">
              <Textarea
                value={draft.lastProgressNote}
                rows={2}
                onChange={(event) => setDraft((current) => ({ ...current, lastProgressNote: event.target.value }))}
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="primary" size="sm" onClick={saveProgress} disabled={!canUpdate || busy}>
                {busy ? "保存中…" : "保存进展"}
              </Button>
            </div>
          </fieldset>
        </Section>

        <Section title="活动" subtitle={`${wpComments.length + wpApprovals.length} 条记录`}>
          {currentUser ? (
            <div className="muted-card" style={{ padding: 10 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <Select
                  value={commentType}
                  onChange={(event) => setCommentType(event.target.value as WorkPackageComment["type"])}
                  style={{ width: 120 }}
                >
                  <option value="comment">评论</option>
                  <option value="decision">决策</option>
                  <option value="blocker">阻塞</option>
                  <option value="evidence">证据</option>
                </Select>
              </div>
              <Textarea
                value={commentBody}
                rows={2}
                placeholder="补充协作记录、决策结论或阻塞原因…"
                onChange={(event) => setCommentBody(event.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <Button size="sm" variant="primary" disabled={busy || !commentBody.trim()} onClick={postComment}>
                  发布
                </Button>
              </div>
            </div>
          ) : null}
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 8 }}>
            {wpComments.length === 0 && wpApprovals.length === 0 ? (
              <li className="hint">暂无协作记录。</li>
            ) : null}
            {wpComments.map((comment) => {
              const author = personLookup.get(comment.authorPersonId);
              return (
                <li
                  key={comment.id}
                  style={{
                    border: "1px solid var(--border-muted)",
                    borderRadius: 8,
                    padding: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: 13 }}>{author?.name ?? comment.authorDisplayName ?? "未知作者"}</strong>
                    <Badge
                      tone={
                        comment.type === "blocker"
                          ? "danger"
                          : comment.type === "decision"
                            ? "done"
                            : comment.type === "evidence"
                              ? "accent"
                              : "default"
                      }
                    >
                      {comment.type === "comment"
                        ? "评论"
                        : comment.type === "decision"
                          ? "决策"
                          : comment.type === "blocker"
                            ? "阻塞"
                            : "证据"}
                    </Badge>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {comment.body}
                  </p>
                  <p className="hint" style={{ margin: "6px 0 0", fontSize: 11 }}>
                    {comment.source && comment.source !== "platform" ? `来源 ${comment.source} · ` : ""}
                    {formatDateTime(comment.createdAt)}
                  </p>
                </li>
              );
            })}
            {wpApprovals.map((approval) => {
              const reviewer = personLookup.get(approval.reviewerPersonId);
              return (
                <li
                  key={approval.id}
                  style={{
                    border: "1px solid var(--border-muted)",
                    borderRadius: 8,
                    padding: 10,
                    background: "var(--bg-subtle)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{reviewer?.name ?? approval.reviewerPersonId}</strong>
                    <Badge
                      tone={
                        approval.status === "approved"
                          ? "success"
                          : approval.status === "changesRequested"
                            ? "danger"
                            : "default"
                      }
                    >
                      {approval.status === "approved" ? "已批准" : approval.status === "changesRequested" ? "需修改" : "待签核"}
                    </Badge>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 13 }}>{approval.comment}</p>
                  <p className="hint" style={{ margin: "6px 0 0", fontSize: 11 }}>
                    {formatDateTime(approval.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Section>

        {canApprove ? (
          <Section title="签核">
            <div className="muted-card" style={{ padding: 10 }}>
              <Textarea
                value={approvalComment}
                rows={2}
                placeholder="可填写签核意见，留空使用默认文案。"
                onChange={(event) => setApprovalComment(event.target.value)}
              />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                <Button size="sm" variant="default" disabled={busy} onClick={() => approve("changesRequested")}>
                  请求修改
                </Button>
                <Button size="sm" variant="success" disabled={busy} onClick={() => approve("approved")}>
                  批准
                </Button>
              </div>
            </div>
          </Section>
        ) : null}

        {error ? (
          <p style={{ color: "var(--danger-fg)", margin: 0, fontSize: 12 }}>{error}</p>
        ) : null}
        {info ? (
          <p style={{ color: "var(--success-fg)", margin: 0, fontSize: 12 }}>{info}</p>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, margin: 0, fontWeight: 600, color: "var(--fg-default)" }}>{title}</h3>
        {subtitle ? <span className="hint" style={{ fontSize: 11 }}>{subtitle}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="label" style={{ fontSize: 11, marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 3H13V6.5M13 3L7 9M5 4H4C3.44772 4 3 4.44772 3 5V12C3 12.5523 3.44772 13 4 13H11C11.5523 13 12 12.5523 12 12V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

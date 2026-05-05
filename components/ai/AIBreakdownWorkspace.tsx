"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { EmptyState } from "@/components/primer/EmptyState";
import { Surface } from "@/components/primer/Surface";
import { Textarea } from "@/components/primer/Textarea";
import { can } from "@/lib/rbac";
import { priorityTone, riskLevelTone, typeLabel, typeTone } from "@/lib/work-package-presentation";
import type { AgentAnalysis, Project, User, WorkPackage } from "@/lib/types";

interface AIBreakdownWorkspaceProps {
  project: Project;
  currentUser?: User;
}

interface DraftState {
  draftId: string | null;
  analysis: AgentAnalysis | null;
}

/**
 * AI breakdown workspace: prompt → AI draft → PM confirmation → real
 * WorkPackages. Uses a single-column flow to keep the journey obvious.
 */
export function AIBreakdownWorkspace({ project, currentUser }: AIBreakdownWorkspaceProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(
    `帮我拆解 ${project.name} 的下一阶段任务，关注负责人、优先级、依赖、进度和风险。`
  );
  const [draft, setDraft] = useState<DraftState>({ draftId: null, analysis: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canUseAi = currentUser ? can(currentUser.role, "useAgentBreakdown") : false;

  async function generateDraft() {
    if (!currentUser) {
      setError("请在右上角选择一个有「使用 AI 拆解」权限的账号。");
      return;
    }
    if (!canUseAi) {
      setError("当前账号无权使用 AI 拆解，请切换到管理员或项目经理。");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({ prompt, projectId: project.id })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "生成 AI 草稿失败");
      }
      const payload = (await response.json()) as { analysis: AgentAnalysis; draftId?: string };
      setDraft({ analysis: payload.analysis, draftId: payload.draftId ?? null });
      setInfo("草稿已生成，确认后将写入正式工作项。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成 AI 草稿失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!currentUser || !draft.draftId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/agent-workflow/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({ draftId: draft.draftId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "确认草稿失败");
      }
      const payload = (await response.json()) as { workPackages: WorkPackage[] };
      setInfo(`已写入 ${payload.workPackages.length} 个工作项。`);
      setDraft({ draftId: null, analysis: null });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认草稿失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Surface
        title="对话式拆解"
        description="输入项目目标，AI 会生成结构化的工作项与风险候选。"
        actions={
          <Button variant="primary" size="sm" disabled={busy} onClick={generateDraft}>
            {busy ? "生成中…" : "生成草稿"}
          </Button>
        }
      >
        <Textarea
          rows={4}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="例如：发布客户成功平台 v1，需要前端、后端、上线流程…"
        />
        {!canUseAi && currentUser ? (
          <p className="hint" style={{ marginTop: 8, color: "var(--attention-emphasis)", fontSize: 12 }}>
            当前角色无 AI 拆解权限。请联系管理员或在右上角切换到管理员/项目经理账号。
          </p>
        ) : null}
        {error ? (
          <p style={{ color: "var(--danger-fg)", marginTop: 8, fontSize: 12 }}>{error}</p>
        ) : null}
        {info ? (
          <p style={{ color: "var(--success-fg)", marginTop: 8, fontSize: 12 }}>{info}</p>
        ) : null}
      </Surface>

      {!draft.analysis ? (
        <Surface>
          <EmptyState
            title="尚未生成草稿"
            description="点击上方「生成草稿」后，AI 输出将出现在这里供项目经理确认。"
          />
        </Surface>
      ) : (
        <>
          <Surface
            title="产品定义"
            description="AI 根据你的输入提炼的目标摘要。"
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              {draft.analysis.productDefinition}
            </p>
            <p className="hint" style={{ marginTop: 12, fontSize: 12 }}>
              {draft.analysis.progressReport}
            </p>
          </Surface>

          <Surface
            title={`建议工作项 (${draft.analysis.tasks.length})`}
            description="确认后会按角色匹配负责人写入正式 WorkPackage。"
            flush
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {draft.analysis.tasks.map((task, index) => (
                <li
                  key={`${task.title}-${index}`}
                  style={{
                    padding: 12,
                    borderTop: index === 0 ? undefined : "1px solid var(--border-muted)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{task.title}</strong>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Badge tone={typeTone(task.type)}>{typeLabel(task.type)}</Badge>
                      <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                    </div>
                  </div>
                  <p className="hint" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
                    {task.description}
                  </p>
                  <p className="hint" style={{ marginTop: 4, fontSize: 11 }}>
                    建议角色 {task.assigneeRole} · 里程碑 {task.milestone}
                  </p>
                </li>
              ))}
            </ul>
          </Surface>

          {draft.analysis.risks.length > 0 ? (
            <Surface
              title={`识别的风险 (${draft.analysis.risks.length})`}
              description="确认后会以 type=risk 写入 WorkPackage 表。"
              flush
            >
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {draft.analysis.risks.map((risk, index) => (
                  <li
                    key={risk.title}
                    style={{
                      padding: 12,
                      borderTop: index === 0 ? undefined : "1px solid var(--border-muted)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{risk.title}</strong>
                      <Badge tone={riskLevelTone(risk.level)}>{risk.level}</Badge>
                    </div>
                    <p className="hint" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>
                      影响 {risk.impact}
                    </p>
                    <p className="hint" style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
                      缓解 {risk.mitigation}
                    </p>
                  </li>
                ))}
              </ul>
            </Surface>
          ) : null}

          {draft.analysis.nextActions.length > 0 ? (
            <Surface title="下一步建议">
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                {draft.analysis.nextActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </Surface>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              alignItems: "center",
              padding: 12,
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-medium)"
            }}
          >
            <p className="hint" style={{ margin: 0, marginRight: "auto", fontSize: 12 }}>
              确认前可继续修改 prompt，重新生成会覆盖当前草稿。
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft({ draftId: null, analysis: null })}
              disabled={busy}
            >
              丢弃草稿
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !draft.draftId}
              onClick={confirmDraft}
            >
              {busy ? "确认中…" : "确认写入工作项"}
            </Button>
          </div>
          <p className="hint" style={{ marginTop: 0, fontSize: 12 }}>
            写入后会出现在 <Link href={`/projects/${project.identifier}/work-packages`}>工作项</Link> 列表。
          </p>
        </>
      )}
    </div>
  );
}

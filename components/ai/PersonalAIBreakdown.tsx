"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/primer/Badge";
import { Button } from "@/components/primer/Button";
import { Input } from "@/components/primer/Input";
import { Select } from "@/components/primer/Select";
import { Surface } from "@/components/primer/Surface";
import { Textarea } from "@/components/primer/Textarea";
import { can } from "@/lib/rbac";
import { priorityTone, riskLevelTone, typeLabel, typeTone } from "@/lib/work-package-presentation";
import type { AgentAnalysis, AgentRiskDraft, AgentTaskDraft, Priority, RiskLevel, User, WorkPackageType } from "@/lib/types";

interface PersonalAIBreakdownProps {
  currentUser?: User;
}

const PRIORITIES: Priority[] = ["P0", "P1", "P2"];
const TASK_TYPES: WorkPackageType[] = ["task", "milestone"];
const RISK_LEVELS: RiskLevel[] = ["Low", "Medium", "High"];

/**
 * Personal AI breakdown flow: prompt, edit candidates, then confirm into My Page.
 */
export function PersonalAIBreakdown({ currentUser }: PersonalAIBreakdownProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("帮我把这段个人需求拆成可执行事项：");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const canUsePersonalAi = currentUser ? can(currentUser.role, "usePersonalAgentBreakdown") : false;

  async function generateDraft() {
    if (!currentUser || !canUsePersonalAi) {
      setError("当前账号无权使用个人 AI 拆解。");
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
        body: JSON.stringify({ prompt, projectId: null })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "生成个人 AI 草稿失败。");
      }

      const payload = (await response.json()) as { draftId?: string; analysis: AgentAnalysis };
      setDraftId(payload.draftId ?? null);
      setAnalysis(payload.analysis);
      setInfo("草稿已生成，可先编辑候选项再写入我的工作台。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成个人 AI 草稿失败。");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!currentUser || !draftId || !analysis) {
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch("/api/agent-workflow/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({ draftId, analysis })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "写入个人工作台失败。");
      }

      const payload = (await response.json()) as { workPackages: unknown[] };
      setInfo(`已写入 ${payload.workPackages.length} 个个人工作项。`);
      setDraftId(null);
      setAnalysis(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "写入个人工作台失败。");
    } finally {
      setBusy(false);
    }
  }

  function updateTask(index: number, patch: Partial<AgentTaskDraft>) {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            tasks: current.tasks.map((task, taskIndex) =>
              taskIndex === index ? { ...task, ...patch } : task
            )
          }
        : current
    );
  }

  function updateRisk(index: number, patch: Partial<AgentRiskDraft>) {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            risks: current.risks.map((risk, riskIndex) =>
              riskIndex === index ? { ...risk, ...patch } : risk
            )
          }
        : current
    );
  }

  function removeTask(index: number) {
    setAnalysis((current) =>
      current ? { ...current, tasks: current.tasks.filter((_, taskIndex) => taskIndex !== index) } : current
    );
  }

  function removeRisk(index: number) {
    setAnalysis((current) =>
      current ? { ...current, risks: current.risks.filter((_, riskIndex) => riskIndex !== index) } : current
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface
        title="个人 AI 拆解"
        description="输入一段需求，AI 会先生成候选事项；确认前可以编辑或删除候选项。"
        actions={
          <Button variant="primary" size="sm" disabled={busy || !canUsePersonalAi} onClick={generateDraft}>
            {busy ? "生成中…" : "生成草稿"}
          </Button>
        }
      >
        <Textarea
          rows={5}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="例如：下周要准备客户汇报、梳理风险并跟进三个待办。"
        />
        {!canUsePersonalAi && currentUser ? (
          <p className="hint" style={{ color: "var(--attention-emphasis)", fontSize: 12 }}>
            当前账号无个人 AI 拆解权限。
          </p>
        ) : null}
        {error ? <p style={{ color: "var(--danger-fg)", fontSize: 12 }}>{error}</p> : null}
        {info ? <p style={{ color: "var(--success-fg)", fontSize: 12 }}>{info}</p> : null}
      </Surface>

      {analysis ? (
        <>
          <Surface title={`候选工作项 (${analysis.tasks.length})`} flush>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {analysis.tasks.map((task, index) => (
                <li
                  key={`${task.title}-${index}`}
                  style={{ padding: 12, borderTop: index === 0 ? undefined : "1px solid var(--border-muted)" }}
                >
                  <EditableTask
                    task={task}
                    onChange={(patch) => updateTask(index, patch)}
                    onRemove={() => removeTask(index)}
                  />
                </li>
              ))}
            </ul>
          </Surface>

          <Surface title={`候选风险 (${analysis.risks.length})`} flush>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {analysis.risks.map((risk, index) => (
                <li
                  key={`${risk.title}-${index}`}
                  style={{ padding: 12, borderTop: index === 0 ? undefined : "1px solid var(--border-muted)" }}
                >
                  <EditableRisk
                    risk={risk}
                    onChange={(patch) => updateRisk(index, patch)}
                    onRemove={() => removeRisk(index)}
                  />
                </li>
              ))}
            </ul>
          </Surface>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Link href="/my/page" className="btn" data-variant="ghost">
              返回工作台
            </Link>
            <Button
              variant="primary"
              disabled={busy || !draftId || analysis.tasks.length + analysis.risks.length === 0}
              onClick={confirmDraft}
            >
              {busy ? "写入中…" : "写入我的工作台"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function EditableTask({
  task,
  onChange,
  onRemove
}: {
  task: AgentTaskDraft;
  onChange: (patch: Partial<AgentTaskDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "inline-flex", gap: 6 }}>
          <Badge tone={typeTone(task.type)}>{typeLabel(task.type)}</Badge>
          <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
        </div>
        <Button size="sm" variant="danger" onClick={onRemove}>
          删除
        </Button>
      </div>
      <Input value={task.title} onChange={(event) => onChange({ title: event.target.value })} />
      <Textarea
        rows={2}
        value={task.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <Select value={task.type} onChange={(event) => onChange({ type: event.target.value as WorkPackageType })}>
          {TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </Select>
        <Select value={task.priority} onChange={(event) => onChange({ priority: event.target.value as Priority })}>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </Select>
        <Input
          value={task.assigneeRole}
          placeholder="建议角色"
          onChange={(event) => onChange({ assigneeRole: event.target.value })}
        />
        <Input
          value={task.milestone}
          placeholder="里程碑"
          onChange={(event) => onChange({ milestone: event.target.value })}
        />
      </div>
    </div>
  );
}

function EditableRisk({
  risk,
  onChange,
  onRemove
}: {
  risk: AgentRiskDraft;
  onChange: (patch: Partial<AgentRiskDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <Badge tone={riskLevelTone(risk.level)}>{risk.level}</Badge>
        <Button size="sm" variant="danger" onClick={onRemove}>
          删除
        </Button>
      </div>
      <Input value={risk.title} onChange={(event) => onChange({ title: event.target.value })} />
      <Select value={risk.level} onChange={(event) => onChange({ level: event.target.value as RiskLevel })}>
        {RISK_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </Select>
      <Textarea rows={2} value={risk.impact} onChange={(event) => onChange({ impact: event.target.value })} />
      <Textarea
        rows={2}
        value={risk.mitigation}
        onChange={(event) => onChange({ mitigation: event.target.value })}
      />
    </div>
  );
}

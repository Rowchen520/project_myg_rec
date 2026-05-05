"use client";

import { useState } from "react";
import { difficultyLabel, formatDateLabel } from "./timeline";
import type { PlanDifficulty, PlanNode, PlanRiskLevel, PlanTask } from "@/lib/services/big-screen-plan";

export interface NodeDetailUpdates {
  title?: string;
  label?: string;
  ownerLabel?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  estimateHours?: number;
  difficulty?: PlanDifficulty;
  riskLevel?: PlanRiskLevel;
  isBlocked?: boolean;
  tasks?: PlanTask[];
}

interface NodeDetailDrawerProps {
  node: PlanNode;
  phaseName: string;
  editing: boolean;
  onClose: () => void;
  onSubmit: (updates: NodeDetailUpdates) => void;
}

/**
 * Right-side drawer for inspecting and editing a key node in detail.
 *
 * In presentation mode the inputs are read-only so investors / leadership can
 * inspect the same panel without accidentally mutating the plan.
 */
export function NodeDetailDrawer({ node, phaseName, editing, onClose, onSubmit }: NodeDetailDrawerProps) {
  const [title, setTitle] = useState(node.title);
  const [label, setLabel] = useState(node.label);
  const [ownerLabel, setOwnerLabel] = useState(node.ownerLabel ?? "");
  const [date, setDate] = useState(toDateInput(node.date));
  const [startDate, setStartDate] = useState(toDateInput(node.startDate));
  const [endDate, setEndDate] = useState(toDateInput(node.endDate));
  const [difficulty, setDifficulty] = useState<PlanDifficulty>(node.difficulty);
  const [estimateHours, setEstimateHours] = useState(String(node.estimateHours ?? ""));
  const [riskLevel, setRiskLevel] = useState<PlanRiskLevel | "none">(node.riskLevel ?? "none");
  const [isBlocked, setIsBlocked] = useState(Boolean(node.isBlocked));
  const [tasks, setTasks] = useState<PlanTask[]>(node.tasks);
  const calculatedProgress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
    : node.progress;

  const handleSave = () => {
    onSubmit({
      title,
      label,
      ownerLabel: ownerLabel || undefined,
      date: fromDateInput(date),
      startDate: fromDateInput(startDate),
      endDate: fromDateInput(endDate),
      progress: calculatedProgress,
      estimateHours: fromNumberInput(estimateHours),
      difficulty,
      riskLevel: riskLevel === "none" ? undefined : riskLevel,
      isBlocked,
      tasks
    });
    onClose();
  };

  return (
    <div className="screen-drawer-backdrop" role="dialog" aria-modal>
      <button type="button" className="screen-drawer-dismiss" aria-label="关闭" onClick={onClose} />
      <aside className="screen-drawer">
        <header>
          <div>
            <p className="screen-drawer-eyebrow">{phaseName} · {difficultyLabel(node.difficulty)}</p>
            <h2>{node.title || "节点详情"}</h2>
            <p className="screen-drawer-meta">
              当前日期：{formatDateLabel(node.date)}
              {node.startDate && node.endDate ? `（区间 ${formatDateLabel(node.startDate)} → ${formatDateLabel(node.endDate)}）` : ""}
            </p>
          </div>
          <button type="button" className="screen-drawer-close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="screen-drawer-body">
          <Field label="标题">
            <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!editing} />
          </Field>
          <Field label="编号 / 标签">
            <input value={label} onChange={(event) => setLabel(event.target.value)} disabled={!editing} />
          </Field>
          <Field label="负责人">
            <input
              value={ownerLabel}
              onChange={(event) => setOwnerLabel(event.target.value)}
              placeholder="例如：王晓"
              disabled={!editing}
            />
          </Field>
          <Field label="节点难度">
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as PlanDifficulty)}
              disabled={!editing}
            >
              <option value="low">低难度</option>
              <option value="medium">中等</option>
              <option value="high">困难</option>
              <option value="critical">特别困难</option>
            </select>
          </Field>
          <section className="screen-drawer-delivery">
            <h3>交付评估</h3>
            <div className="screen-drawer-delivery-grid">
              <Field label="预估工时">
                <input
                  type="number"
                  min={0}
                  value={estimateHours}
                  onChange={(event) => setEstimateHours(event.target.value)}
                  placeholder="例如：16"
                  disabled={!editing}
                />
              </Field>
              <Field label="风险等级">
                <select
                  value={riskLevel}
                  onChange={(event) => setRiskLevel(event.target.value as PlanRiskLevel | "none")}
                  disabled={!editing}
                >
                  <option value="none">无风险</option>
                  <option value="low">低风险</option>
                  <option value="medium">中风险</option>
                  <option value="high">高风险</option>
                </select>
              </Field>
            </div>
            <p className="screen-keyboard-hint">关键路径通过大屏红色连线设置。</p>
            <label className="screen-drawer-check">
              <input
                type="checkbox"
                checked={isBlocked}
                onChange={(event) => setIsBlocked(event.target.checked)}
                disabled={!editing}
              />
              <span>当前存在阻塞</span>
            </label>
          </section>
          {node.shape === "task" ? (
            <>
              <Field label="开始日期">
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={!editing} />
              </Field>
              <Field label="结束日期">
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={!editing} />
              </Field>
            </>
          ) : (
            <Field label="计划日期">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={!editing} />
            </Field>
          )}
          <p className="screen-keyboard-hint">
            节点完成度 {calculatedProgress}% 由任务项次进度自动计算。
          </p>

          <section className="screen-drawer-tasks">
            <header>
              <h3>任务项次（{tasks.length}）</h3>
              {editing ? (
                <button
                  type="button"
                  className="screen-drawer-task-add"
                  onClick={() =>
                    setTasks((current) => [
                      ...current,
                      {
                        id: `task-${Date.now()}-${current.length}`,
                        title: "新增任务项",
                        ownerLabel: "未分配",
                        difficulty,
                        progress: 0,
                        status: "todo"
                      }
                    ])
                  }
                >
                  + 新增任务项
                </button>
              ) : null}
            </header>
            {tasks.length === 0 ? (
              <p className="screen-keyboard-hint">
                {editing
                  ? "该节点暂无任务项次，点击右上角“+ 新增任务项”追加。"
                  : "该节点暂未挂接任务条目。"}
              </p>
            ) : (
              <ul>
                {tasks.map((task, index) => (
                  <li key={task.id}>
                    <input
                      className="screen-drawer-task-title"
                      value={task.title}
                      onChange={(event) =>
                        setTasks((current) =>
                          current.map((item, idx) =>
                            idx === index ? { ...item, title: event.target.value } : item
                          )
                        )
                      }
                      placeholder="任务标题"
                      disabled={!editing}
                    />
                    <input
                      className="screen-drawer-task-owner"
                      value={task.ownerLabel}
                      onChange={(event) =>
                        setTasks((current) =>
                          current.map((item, idx) =>
                            idx === index ? { ...item, ownerLabel: event.target.value } : item
                          )
                        )
                      }
                      placeholder="负责人"
                      disabled={!editing}
                    />
                    <input
                      className="screen-drawer-task-progress"
                      type="number"
                      min={0}
                      max={100}
                      value={task.progress}
                      onChange={(event) =>
                        setTasks((current) =>
                          current.map((item, idx) =>
                            idx === index
                              ? { ...item, progress: clampProgress(Number(event.target.value)) }
                              : item
                          )
                        )
                      }
                      disabled={!editing}
                    />
                    <span className="screen-drawer-task-pct">%</span>
                    {editing ? (
                      <button
                        type="button"
                        className="screen-drawer-task-remove"
                        aria-label={`删除任务 ${task.title}`}
                        onClick={() =>
                          setTasks((current) => current.filter((_, idx) => idx !== index))
                        }
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <footer>
          <button type="button" className="screen-control-button" onClick={onClose}>
            {editing ? "取消" : "关闭"}
          </button>
          {editing ? (
            <button type="button" className="screen-control-button screen-generate-button" onClick={handleSave}>
              保存改动
            </button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="screen-drawer-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function toDateInput(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function fromNumberInput(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.round(parsed));
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

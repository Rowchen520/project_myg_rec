"use client";

import { useMemo } from "react";
import { formatDateLabel } from "./timeline";
import type { PlanModel, PlanNode, PlanPhase } from "@/lib/services/big-screen-plan";

interface ScenarioApplyDialogProps {
  scenarioName: string;
  baseline: PlanModel | null;
  draft: PlanModel;
  applying: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

interface NodeDiff {
  id: string;
  title: string;
  kind: "added" | "removed" | "moved" | "renamed" | "owner";
  before?: PlanNode;
  after?: PlanNode;
  message: string;
}

interface PhaseDiff {
  id: string;
  name: string;
  kind: "added" | "removed" | "renamed";
  before?: PlanPhase;
  after?: PlanPhase;
  message: string;
}

/**
 * Modal that previews the differences between the current scenario draft and
 * the active baseline before the PM applies it.
 */
export function ScenarioApplyDialog({
  scenarioName,
  baseline,
  draft,
  applying,
  onClose,
  onConfirm
}: ScenarioApplyDialogProps) {
  const { nodeDiffs, phaseDiffs, criticalCount } = useMemo(() => diff(baseline, draft), [baseline, draft]);
  const total = nodeDiffs.length + phaseDiffs.length;

  return (
    <div className="screen-modal-backdrop" role="dialog" aria-modal>
      <div className="screen-modal screen-apply-modal">
        <header>
          <h2>应用「{scenarioName}」到基线</h2>
          <button type="button" className="screen-modal-close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <p className="screen-modal-hint">
          {total === 0
            ? "当前草稿与基线一致，应用后不会产生变更。"
            : `检测到 ${total} 项差异${criticalCount ? `，其中 ${criticalCount} 项位于关键路径` : ""}。请确认无误后再应用。`}
        </p>

        {phaseDiffs.length ? (
          <section className="screen-apply-section">
            <h3>阶段变更（{phaseDiffs.length}）</h3>
            <ul>
              {phaseDiffs.map((diffRow) => (
                <li key={`phase-${diffRow.id}-${diffRow.kind}`} data-kind={diffRow.kind}>
                  <strong>{diffRow.name}</strong>
                  <span>{diffRow.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {nodeDiffs.length ? (
          <section className="screen-apply-section">
            <h3>节点变更（{nodeDiffs.length}）</h3>
            <ul>
              {nodeDiffs.map((diffRow) => (
                <li key={`node-${diffRow.id}-${diffRow.kind}`} data-kind={diffRow.kind}>
                  <strong>{diffRow.title}</strong>
                  <span>{diffRow.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer>
          <button type="button" className="screen-control-button" onClick={onClose} disabled={applying}>取消</button>
          <button
            type="button"
            className="screen-control-button screen-generate-button"
            onClick={onConfirm}
            disabled={applying}
          >
            {applying ? "应用中..." : "确认应用并生成新基线"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function diff(
  baseline: PlanModel | null,
  draft: PlanModel
): { nodeDiffs: NodeDiff[]; phaseDiffs: PhaseDiff[]; criticalCount: number } {
  const nodeDiffs: NodeDiff[] = [];
  const phaseDiffs: PhaseDiff[] = [];
  let criticalCount = 0;
  if (!baseline) {
    return { nodeDiffs, phaseDiffs, criticalCount };
  }

  const baselinePhasesById = new Map(baseline.phases.map((phase) => [phase.id, phase]));
  const draftPhasesById = new Map(draft.phases.map((phase) => [phase.id, phase]));
  for (const phase of draft.phases) {
    const previous = baselinePhasesById.get(phase.id);
    if (!previous) {
      phaseDiffs.push({ id: phase.id, name: phase.name, kind: "added", after: phase, message: "新增阶段" });
    } else if (previous.name !== phase.name) {
      phaseDiffs.push({
        id: phase.id,
        name: phase.name,
        kind: "renamed",
        before: previous,
        after: phase,
        message: `阶段名称：${previous.name} → ${phase.name}`
      });
    }
  }
  for (const phase of baseline.phases) {
    if (!draftPhasesById.has(phase.id)) {
      phaseDiffs.push({ id: phase.id, name: phase.name, kind: "removed", before: phase, message: "删除阶段" });
    }
  }

  const baselineNodesById = new Map(baseline.nodes.map((node) => [node.id, node]));
  const draftNodesById = new Map(draft.nodes.map((node) => [node.id, node]));
  for (const node of draft.nodes) {
    const previous = baselineNodesById.get(node.id);
    if (!previous) {
      nodeDiffs.push({ id: node.id, title: node.title, kind: "added", after: node, message: "新增节点" });
      if (node.isOnCriticalPath) criticalCount += 1;
      continue;
    }
    if (previous.date !== node.date || previous.startDate !== node.startDate || previous.endDate !== node.endDate) {
      nodeDiffs.push({
        id: node.id,
        title: node.title,
        kind: "moved",
        before: previous,
        after: node,
        message: `日期：${formatDateLabel(previous.date)} → ${formatDateLabel(node.date)}`
      });
      if (node.isOnCriticalPath || previous.isOnCriticalPath) criticalCount += 1;
      continue;
    }
    if (previous.title !== node.title) {
      nodeDiffs.push({
        id: node.id,
        title: node.title,
        kind: "renamed",
        before: previous,
        after: node,
        message: `标题：${previous.title} → ${node.title}`
      });
      continue;
    }
    if ((previous.ownerLabel ?? "") !== (node.ownerLabel ?? "")) {
      nodeDiffs.push({
        id: node.id,
        title: node.title,
        kind: "owner",
        before: previous,
        after: node,
        message: `负责人：${previous.ownerLabel ?? "未分配"} → ${node.ownerLabel ?? "未分配"}`
      });
    }
  }
  for (const node of baseline.nodes) {
    if (!draftNodesById.has(node.id)) {
      nodeDiffs.push({ id: node.id, title: node.title, kind: "removed", before: node, message: "删除节点" });
      if (node.isOnCriticalPath) criticalCount += 1;
    }
  }

  return { nodeDiffs, phaseDiffs, criticalCount };
}

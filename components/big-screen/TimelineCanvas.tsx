"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";
import { flushSync } from "react-dom";
import {
  DAY_MS,
  HEADER_ROW_HEIGHT,
  SIDEBAR_WIDTH,
  difficultyLabel,
  formatDateLabel,
  type GanttRow,
  type TimelineWindow
} from "./timeline";
import type { PlanModel, PlanNode } from "@/lib/services/big-screen-plan";

export type LinkMode = "none" | "dependency" | "critical";

const EDGE_BUFFER_PX = 96;
const EDGE_AUTO_SCROLL_PX = 14;
const EDGE_EXTEND_DAYS = 7;
const EDGE_THROTTLE_MS = 220;
const MIN_NAME_COLUMN_WIDTH = 260;
const MAX_NAME_COLUMN_WIDTH = 520;

interface TimelineCanvasProps {
  plan: PlanModel;
  timeline: TimelineWindow;
  scrollRef: RefObject<HTMLDivElement | null>;
  scale: number;
  selectedId?: string;
  selectedPhaseId?: string;
  draggingId: string | null;
  linkMode: LinkMode;
  pendingLinkFromId?: string;
  selectedDependencyKey?: string;
  editing: boolean;
  baselinePlan: PlanModel | null;
  onSelect: (nodeId: string) => void;
  onSelectPhase: (phaseId: string) => void;
  onOpenDetail: (nodeId: string) => void;
  onDeletePhase: (phaseId: string) => void;
  onRenamePhase: (phaseId: string, name: string) => void;
  onLinkNode: (nodeId: string) => void;
  onSelectDependency: (dependencyKey: string) => void;
  onClearSelection: () => void;
  onDragStart: (nodeId: string) => void;
  onDragEnd: () => void;
  onCommitDrag: (nodeId: string, dropDate: string, dropPhaseId: string) => void;
  onResizeCommit: (nodeId: string, startDate: string, endDate: string) => void;
  onExtendTimeline: (direction: "left" | "right", days: number) => void;
}

/**
 * Renders the gantt grid: a fixed left "name" column listing the phase
 * headings and tasks, paired with a horizontally scrollable timeline canvas
 * that draws the matching gantt bars, milestones and decorations on the
 * exact same row baseline.
 */
export function TimelineCanvas({
  plan,
  timeline,
  scrollRef,
  scale,
  selectedId,
  selectedPhaseId,
  draggingId,
  linkMode,
  pendingLinkFromId,
  selectedDependencyKey,
  editing,
  baselinePlan,
  onSelect,
  onSelectPhase,
  onOpenDetail,
  onDeletePhase,
  onRenamePhase,
  onLinkNode,
  onSelectDependency,
  onClearSelection,
  onDragStart,
  onDragEnd,
  onCommitDrag,
  onResizeCommit,
  onExtendTimeline
}: TimelineCanvasProps) {
  const dragLabelRef = useRef<HTMLDivElement | null>(null);
  const draggingNodeRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [hoveredNodeId, setHoveredNodeId] = useState<string | undefined>();
  const [nameColumnWidth, setNameColumnWidth] = useState(SIDEBAR_WIDTH);

  useEffect(() => () => cleanupRef.current(), []);
  const activePopoverId = draggingId || linkMode !== "none" ? undefined : hoveredNodeId ?? selectedId;

  /**
   * Drag loop: directly mutates the dragged element's transform via rAF and
   * keeps the floating date label aligned with the cursor. The timeline auto
   * extends when the cursor approaches the edges.
   */
  const beginDrag = useCallback(
    (node: PlanNode, event: ReactPointerEvent<HTMLDivElement>, row: GanttRow) => {
      if (!editing || linkMode !== "none") return;
      const scroll = scrollRef.current;
      const labelEl = dragLabelRef.current;
      if (!scroll) return;

      const initialLeft = computeInitialLeft(node, timeline);
      const initialTop = row.top;
      const scrollRect = scroll.getBoundingClientRect();
      const grabOffsetX =
        (event.clientX - scrollRect.left + scroll.scrollLeft) / scale - initialLeft;

      draggingNodeRef.current = event.currentTarget;
      onSelect(node.id);
      onDragStart(node.id);

      let lastLeft = initialLeft;
      let lastClientX = event.clientX;
      let lastClientY = event.clientY;
      let pendingFrame = 0;
      let lastEdgeAt = 0;

      const apply = () => {
        pendingFrame = 0;
        if (draggingNodeRef.current) {
          draggingNodeRef.current.style.transform = `translate3d(${lastLeft}px, ${initialTop}px, 0)`;
        }
        if (labelEl) {
          const date = timeline.pixelToDate(lastLeft);
          labelEl.textContent = `→ ${formatDateLabel(date)}`;
          labelEl.style.transform = `translate3d(${lastClientX + 18}px, ${lastClientY - 16}px, 0)`;
          labelEl.style.opacity = "1";
        }
      };

      const handleMove = (moveEvent: PointerEvent) => {
        lastClientX = moveEvent.clientX;
        lastClientY = moveEvent.clientY;
        const rect = scroll.getBoundingClientRect();
        const canvasX = (moveEvent.clientX - rect.left + scroll.scrollLeft) / scale;
        lastLeft = canvasX - grabOffsetX;
        if (!pendingFrame) pendingFrame = window.requestAnimationFrame(apply);

        const now = performance.now();
        if (now - lastEdgeAt > EDGE_THROTTLE_MS) {
          if (moveEvent.clientX > rect.right - EDGE_BUFFER_PX) {
            scroll.scrollLeft += EDGE_AUTO_SCROLL_PX;
            onExtendTimeline("right", EDGE_EXTEND_DAYS);
            lastEdgeAt = now;
          } else if (moveEvent.clientX < rect.left + EDGE_BUFFER_PX) {
            const deltaPx = EDGE_EXTEND_DAYS * timeline.pixelsPerDay;
            lastLeft += deltaPx;
            onExtendTimeline("left", EDGE_EXTEND_DAYS);
            lastEdgeAt = now;
          }
        }
      };

      const handleEnd = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
        cleanupRef.current = () => {};
        if (pendingFrame) {
          window.cancelAnimationFrame(pendingFrame);
          pendingFrame = 0;
        }
        if (labelEl) labelEl.style.opacity = "0";

        // If the user just clicked (no actual movement), skip the commit so
        // the resize-set duration is preserved instead of being re-written
        // by a no-op drag.
        const moved = Math.abs(lastLeft - initialLeft) > 2;
        const dropDate = timeline.pixelToDate(lastLeft);
        draggingNodeRef.current = null;
        if (moved) onCommitDrag(node.id, dropDate, node.phaseId);
        onDragEnd();
      };

      cleanupRef.current = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
        if (pendingFrame) {
          window.cancelAnimationFrame(pendingFrame);
          pendingFrame = 0;
        }
        if (labelEl) labelEl.style.opacity = "0";
        draggingNodeRef.current = null;
        onDragEnd();
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
      apply();
    },
    [editing, linkMode, onCommitDrag, onDragEnd, onDragStart, onExtendTimeline, onSelect, scale, scrollRef, timeline]
  );

  /**
   * Long-press pan: when the user grabs an empty area of the canvas we move
   * the horizontal scroll instead of treating it as a click. Once the
   * scroll reaches an edge we ask the parent to extend the timeline window
   * so the user can keep panning into history / future.
   */
  const handleCanvasPanDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          ".screen-gantt-task-bar, .screen-gantt-milestone, .screen-gantt-resize-handle"
        )
      ) {
        return;
      }
      const scroll = scrollRef.current;
      if (!scroll) return;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      let lastClientX = event.clientX;
      let lastEdgeAt = 0;
      let moved = false;

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - lastClientX;
        lastClientX = moveEvent.clientX;
        moved =
          moved ||
          Math.abs(moveEvent.clientX - startClientX) > 3 ||
          Math.abs(moveEvent.clientY - startClientY) > 3;
        scroll.scrollLeft -= dx;

        const now = performance.now();
        if (now - lastEdgeAt > 220) {
          if (scroll.scrollLeft <= 4) {
            onExtendTimeline("left", 30);
            lastEdgeAt = now;
          } else if (scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 4) {
            onExtendTimeline("right", 30);
            lastEdgeAt = now;
          }
        }
      };

      const handleEnd = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
        document.body.style.cursor = "";
        if (!moved) {
          setHoveredNodeId(undefined);
          onClearSelection();
        }
      };

      document.body.style.cursor = "grabbing";
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
    },
    [onClearSelection, onExtendTimeline, scrollRef]
  );

  const handleNameColumnResize = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = nameColumnWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMove = (moveEvent: MouseEvent) => {
        const delta = (moveEvent.clientX - startX) / Math.max(0.1, scale);
        setNameColumnWidth(clamp(startWidth + delta, MIN_NAME_COLUMN_WIDTH, MAX_NAME_COLUMN_WIDTH));
      };

      const handleEnd = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleEnd);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
    },
    [nameColumnWidth, scale]
  );

  const handleDependencyPickDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (linkMode !== "none" || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest(".screen-gantt-task-bar, .screen-gantt-milestone, .screen-gantt-resize-handle")) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const hit = hitTestDependencyLine(
        plan,
        timeline,
        (event.clientX - rect.left) / Math.max(0.1, scale),
        (event.clientY - rect.top) / Math.max(0.1, scale)
      );
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      setHoveredNodeId(undefined);
      onSelectDependency(hit);
    },
    [linkMode, onSelectDependency, plan, scale, timeline]
  );

  const cssVars: CSSProperties & Record<string, string> = {
    "--timeline-canvas-width": `${timeline.canvasWidth}px`,
    "--timeline-total-height": `${timeline.totalHeight}px`,
    "--timeline-today-left": `${timeline.todayLeft}px`,
    "--timeline-name-width": `${nameColumnWidth}px`,
    "--timeline-header-height": `${HEADER_ROW_HEIGHT}px`
  };

  const totalCanvasWidth = nameColumnWidth + timeline.canvasWidth;
  const totalCanvasHeight = HEADER_ROW_HEIGHT + timeline.totalHeight;
  const dependencyNodeIds = new Set(
    plan.dependencies
      .filter((dependency) => !dependency.isCritical)
      .flatMap((dependency) => [dependency.fromNodeId, dependency.toNodeId])
  );

  return (
      <div ref={scrollRef} className="screen-gantt-shell" data-link-mode={linkMode} style={cssVars}>
      <div
        className="screen-gantt-grid"
        style={{ width: totalCanvasWidth, height: totalCanvasHeight }}
      >
        <div className="screen-gantt-corner">
          <span>阶段 / 任务名称</span>
          <button
            type="button"
            className="screen-gantt-name-resize-handle"
            aria-label="调整阶段任务名称列宽"
            title="拖拽调整阶段 / 任务名称列宽"
            onMouseDown={handleNameColumnResize}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setNameColumnWidth((width) => clamp(width - 16, MIN_NAME_COLUMN_WIDTH, MAX_NAME_COLUMN_WIDTH));
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setNameColumnWidth((width) => clamp(width + 16, MIN_NAME_COLUMN_WIDTH, MAX_NAME_COLUMN_WIDTH));
              }
            }}
          />
        </div>
        <RulerLayer timeline={timeline} />
        <div
          className="screen-gantt-name-body"
          style={{ width: nameColumnWidth, height: timeline.totalHeight }}
        >
          {timeline.rows.map((row) => (
            <NameCell
              key={`name-${row.id}`}
              row={row}
              selectedId={selectedId}
              selectedPhaseId={selectedPhaseId}
              linkMode={linkMode}
              editing={editing}
              onSelect={onSelect}
              onSelectPhase={onSelectPhase}
              onDeletePhase={onDeletePhase}
              onRenamePhase={onRenamePhase}
              onHoverNode={setHoveredNodeId}
            />
          ))}
        </div>
        <div
          className="screen-gantt-canvas-body"
          style={{ width: timeline.canvasWidth, height: timeline.totalHeight }}
          onPointerDownCapture={handleDependencyPickDown}
          onPointerDown={handleCanvasPanDown}
        >
          <RowBackgroundLayer timeline={timeline} />
          <MonthDividerLayer timeline={timeline} />
          <BaselineGhostLayer plan={plan} baselinePlan={baselinePlan} timeline={timeline} />
          <DependencyLayer
            plan={plan}
            timeline={timeline}
            selectedDependencyKey={selectedDependencyKey}
          />
          {timeline.rows.map((row) => {
            if (row.kind === "phase") {
              return <PhaseBar key={`bar-${row.id}`} row={row} />;
            }
            if (row.kind === "milestone") {
              return (
                <MilestoneMark
                  key={`bar-${row.id}`}
                  row={row}
                  timeline={timeline}
                  selected={selectedId === row.id}
                  hasDependency={dependencyNodeIds.has(row.id)}
                  linkMode={linkMode}
                  linkSource={pendingLinkFromId === row.id}
                  popoverOpen={activePopoverId === row.id}
                  dragging={draggingId === row.id}
                  editing={editing}
                  onSelect={onSelect}
                  onLinkNode={onLinkNode}
                  onOpenDetail={onOpenDetail}
                  onPointerDown={beginDrag}
                  onHoverNode={setHoveredNodeId}
                />
              );
            }
            return (
              <TaskGanttBar
                key={`bar-${row.id}`}
                row={row}
                timeline={timeline}
                selected={selectedId === row.id}
                hasDependency={dependencyNodeIds.has(row.id)}
                linkMode={linkMode}
                linkSource={pendingLinkFromId === row.id}
                popoverOpen={activePopoverId === row.id}
                dragging={draggingId === row.id}
                editing={editing}
                dragLabelRef={dragLabelRef}
                onSelect={onSelect}
                onLinkNode={onLinkNode}
                onOpenDetail={onOpenDetail}
                onPointerDown={beginDrag}
                onResizeCommit={onResizeCommit}
                onHoverNode={setHoveredNodeId}
              />
            );
          })}
          <div
            className="screen-today-line"
            style={{ left: timeline.todayLeft, height: timeline.totalHeight }}
          >
            <span>今日</span>
          </div>
        </div>
      </div>
      <div ref={dragLabelRef} className="screen-drag-label" />
    </div>
  );
}

function computeInitialLeft(node: PlanNode, timeline: TimelineWindow): number {
  if (node.shape === "milestone") {
    return timeline.dateToPixel(node.date);
  }
  return timeline.dateToPixel(node.startDate ?? node.date);
}

function NameCell({
  row,
  selectedId,
  selectedPhaseId,
  linkMode,
  editing,
  onSelect,
  onSelectPhase,
  onDeletePhase,
  onRenamePhase,
  onHoverNode
}: {
  row: GanttRow;
  selectedId?: string;
  selectedPhaseId?: string;
  linkMode: LinkMode;
  editing: boolean;
  onSelect: (nodeId: string) => void;
  onSelectPhase: (phaseId: string) => void;
  onDeletePhase: (phaseId: string) => void;
  onRenamePhase: (phaseId: string, name: string) => void;
  onHoverNode: (nodeId: string | undefined) => void;
}) {
  const [editingPhaseName, setEditingPhaseName] = useState(false);
  const [phaseNameDraft, setPhaseNameDraft] = useState("");

  if (row.kind === "phase") {
    const phase = row.phase;
    const isSelected = selectedPhaseId === phase.id;

    const beginRename = () => {
      onSelectPhase(phase.id);
      setPhaseNameDraft(phase.name);
      setEditingPhaseName(true);
    };

    const cancelRename = () => {
      setPhaseNameDraft(phase.name);
      setEditingPhaseName(false);
    };

    const commitRename = () => {
      const nextName = phaseNameDraft.trim();
      if (!nextName) {
        cancelRename();
        return;
      }
      if (nextName !== phase.name) onRenamePhase(phase.id, nextName);
      setEditingPhaseName(false);
    };

    return (
      <div
        className={`screen-gantt-name-cell phase ${phase.difficulty}`}
        data-selected={isSelected}
        data-phase-color={phase.difficulty}
        style={{ height: row.height }}
      >
        {editingPhaseName ? (
          <form
            className="screen-gantt-phase-pick editing"
            onSubmit={(event) => {
              event.preventDefault();
              commitRename();
            }}
          >
            <span className="screen-gantt-phase-badge">阶段</span>
            <span className="screen-gantt-phase-title editing">
              <input
                className="screen-gantt-phase-title-input"
                value={phaseNameDraft}
                autoFocus
                aria-label={`阶段名称：${phase.name}`}
                onChange={(event) => setPhaseNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
              />
              <small>{formatDateLabel(phase.startDate)} — {formatDateLabel(phase.endDate)}</small>
            </span>
            <button type="submit" className="screen-gantt-phase-action primary">保存</button>
            <button type="button" className="screen-gantt-phase-action" onClick={cancelRename}>取消</button>
          </form>
        ) : (
          <button
            type="button"
            className="screen-gantt-phase-pick"
            onClick={() => onSelectPhase(phase.id)}
            aria-pressed={isSelected}
            title="选中该阶段，新增节点会归入此阶段"
          >
            <span className="screen-gantt-phase-badge">阶段</span>
            <span className="screen-gantt-phase-title">
              <strong>{phase.name}</strong>
              <small>{formatDateLabel(phase.startDate)} — {formatDateLabel(phase.endDate)}</small>
            </span>
            <span className="screen-gantt-phase-progress">
              <span style={{ width: `${phase.progress}%` }} />
            </span>
            <span className="screen-gantt-phase-pct">{phase.progress}%</span>
          </button>
        )}
        {editing && !editingPhaseName ? (
          <button
            type="button"
            className="screen-gantt-phase-action rename"
            onClick={beginRename}
            aria-label={`修改阶段名称 ${phase.name}`}
          >
            改名
          </button>
        ) : null}
        {editing ? (
          <button
            type="button"
            className="screen-gantt-phase-delete"
            onClick={() => onDeletePhase(phase.id)}
            aria-label={`删除阶段 ${phase.name}`}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }

  const node = row.node;
  const isSelected = selectedId === node.id;
  const indexLabel =
    row.kind === "milestone" && /^M\d+$/i.test(node.label) ? node.label : "";
  const summary =
    row.kind === "milestone"
      ? `${node.ownerLabel ?? "未分配"} · ${formatDateLabel(node.date)}`
      : `${node.ownerLabel ?? "未分配"} · ${node.progress}%`;
  return (
    <button
      type="button"
      className={`screen-gantt-name-cell task ${node.shape} ${node.difficulty}`}
      data-selected={isSelected}
      data-critical={node.isOnCriticalPath || undefined}
      data-phase-color={row.phase.difficulty}
      style={{ height: row.height }}
      onClick={() => onSelect(node.id)}
      onPointerEnter={() => {
        if (linkMode === "none") onHoverNode(node.id);
      }}
      onPointerLeave={() => onHoverNode(undefined)}
    >
      <span className={`screen-gantt-name-shape ${node.shape}`} aria-hidden />
      <span className="screen-gantt-name-text">
        <strong>
          {indexLabel ? <em>{indexLabel} · </em> : null}
          {node.title}
        </strong>
        <small>{summary}</small>
      </span>
    </button>
  );
}

function RulerLayer({ timeline }: { timeline: TimelineWindow }) {
  return (
    <div className="screen-gantt-ruler" style={{ width: timeline.canvasWidth }}>
      {timeline.months.map((month) => (
        <div
          key={month.key}
          className="screen-gantt-ruler-cell"
          style={{ left: month.left, width: month.width }}
        >
          <span>{month.label}</span>
          <small>{month.year}</small>
        </div>
      ))}
    </div>
  );
}

function RowBackgroundLayer({ timeline }: { timeline: TimelineWindow }) {
  return (
    <>
      {timeline.rows.map((row, index) => {
        const difficulty = row.kind === "phase" ? row.phase.difficulty : "";
        return (
          <div
            key={`row-bg-${row.id}`}
            className={`screen-gantt-row-bg ${row.kind} ${index % 2 === 0 ? "even" : "odd"} ${difficulty}`.trim()}
            data-phase-color={row.phase.difficulty}
            style={{ top: row.top, height: row.height, width: timeline.canvasWidth }}
          />
        );
      })}
    </>
  );
}

function MonthDividerLayer({ timeline }: { timeline: TimelineWindow }) {
  return (
    <>
      {timeline.months.map((month) => (
        <div
          key={`vline-${month.key}`}
          className="screen-gantt-month-divider"
          style={{ left: month.left, height: timeline.totalHeight }}
        />
      ))}
    </>
  );
}

function PhaseBar({ row }: { row: Extract<GanttRow, { kind: "phase" }> }) {
  return (
    <div
      className={`screen-gantt-phase-bar ${row.phase.difficulty}`}
      data-phase-color={row.phase.difficulty}
      style={{ top: row.top, height: row.height, width: "100%" }}
    >
      <span className="screen-gantt-phase-bar-fill" style={{ width: `${row.phase.progress}%` }} />
    </div>
  );
}

function TaskGanttBar({
  row,
  timeline,
  selected,
  hasDependency,
  linkMode,
  linkSource,
  popoverOpen,
  dragging,
  editing,
  dragLabelRef,
  onSelect,
  onLinkNode,
  onOpenDetail,
  onPointerDown,
  onResizeCommit,
  onHoverNode
}: {
  row: Extract<GanttRow, { kind: "task" }>;
  timeline: TimelineWindow;
  selected: boolean;
  hasDependency: boolean;
  linkMode: LinkMode;
  linkSource: boolean;
  popoverOpen: boolean;
  dragging: boolean;
  editing: boolean;
  dragLabelRef: RefObject<HTMLDivElement | null>;
  onSelect: (nodeId: string) => void;
  onLinkNode: (nodeId: string) => void;
  onOpenDetail: (nodeId: string) => void;
  onPointerDown: (
    node: PlanNode,
    event: ReactPointerEvent<HTMLDivElement>,
    row: GanttRow
  ) => void;
  onResizeCommit: (nodeId: string, startDate: string, endDate: string) => void;
  onHoverNode: (nodeId: string | undefined) => void;
}) {
  const node = row.node;
  const barTop = row.top + (row.height - 24) / 2;
  const hasActualDelay = (node.directDelayDays ?? node.delayDays ?? 0) > 0;
  // Progress is expressed as a percentage of the bar's *visual* width so it
  // stays in sync with the CSS `min-width` floor used to keep short tasks
  // readable. row.barWidth is still the authoritative date-driven length.
  const progressPercent = Math.min(100, Math.max(2, node.progress));

  /**
   * Edge resize. While the pointer is down we drive the gantt bar's
   * transform/width directly via rAF (so the bar visibly stretches in real
   * time) and write the live start → end + workday count into the floating
   * date label. State is only committed on pointerup.
   */
  const beginResize = (side: "start" | "end", event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(node.id);

    const barEl = event.currentTarget.closest(".screen-gantt-task-bar") as HTMLDivElement | null;
    const progressEl = barEl?.querySelector<HTMLSpanElement>(".screen-gantt-task-bar-progress");
    const labelEl = dragLabelRef.current;
    if (!barEl) return;

    barEl.setAttribute("data-resizing", "true");

    const initialStartPx = row.barLeft;
    const initialEndPx = row.barLeft + row.barWidth;
    const startClientX = event.clientX;
    const pixelsPerClient = 1 / Math.max(0.1, getScaleFromTransform(event));
    const MIN_PX = Math.max(24, timeline.pixelsPerDay);

    let nextStartPx = initialStartPx;
    let nextEndPx = initialEndPx;
    let lastClientX = event.clientX;
    let lastClientY = event.clientY;
    let pendingFrame = 0;

    const apply = () => {
      pendingFrame = 0;
      const width = nextEndPx - nextStartPx;
      barEl.style.transform = `translate3d(${nextStartPx}px, ${barTop}px, 0)`;
      barEl.style.width = `${width}px`;
      if (progressEl) {
        progressEl.style.width = `${Math.min(100, Math.max(2, node.progress))}%`;
      }
      if (labelEl) {
        const startIso = timeline.pixelToDate(nextStartPx);
        const endIso = timeline.pixelToDate(nextEndPx);
        const workdays = countWorkdays(startIso, endIso);
        const totalDays = Math.max(1, Math.round((nextEndPx - nextStartPx) / timeline.pixelsPerDay));
        labelEl.textContent = `${formatDateLabel(startIso)} → ${formatDateLabel(endIso)} · ${totalDays} 天 / ${workdays} 工作日`;
        labelEl.style.transform = `translate3d(${lastClientX + 18}px, ${lastClientY - 16}px, 0)`;
        labelEl.style.opacity = "1";
      }
    };

    const handleMove = (moveEvent: PointerEvent) => {
      lastClientX = moveEvent.clientX;
      lastClientY = moveEvent.clientY;
      const deltaPx = (moveEvent.clientX - startClientX) * pixelsPerClient;
      if (side === "start") {
        nextStartPx = Math.min(initialEndPx - MIN_PX, initialStartPx + deltaPx);
      } else {
        nextEndPx = Math.max(initialStartPx + MIN_PX, initialEndPx + deltaPx);
      }
      if (!pendingFrame) pendingFrame = window.requestAnimationFrame(apply);
    };

    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
      if (pendingFrame) {
        window.cancelAnimationFrame(pendingFrame);
        pendingFrame = 0;
      }
      if (labelEl) labelEl.style.opacity = "0";
      const start = timeline.pixelToDate(nextStartPx);
      const end = timeline.pixelToDate(nextEndPx);
      // Synchronously flush React so the bar's React-controlled inline styles
      // (transform/width/progress) reflect the committed dates *before* the
      // gesture ends. Otherwise React's later async render briefly leaves
      // the imperative mutation visible and then overwrites it on the next
      // paint, which the user sees as a "snap back".
      flushSync(() => {
        onResizeCommit(node.id, start, end);
      });
      barEl.removeAttribute("data-resizing");
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    apply();
  };

  return (
    <div
      className={`screen-gantt-task-bar ${node.difficulty} color-${row.colorIndex % 4}`}
      data-selected={selected}
      data-link-source={linkSource || undefined}
      data-popover-open={popoverOpen}
      data-dragging={dragging}
      data-critical={node.isOnCriticalPath}
      data-risk={node.riskLevel}
      data-blocked={node.isBlocked || undefined}
      data-delay={hasActualDelay || undefined}
      style={{
        transform: `translate3d(${row.barLeft}px, ${barTop}px, 0)`,
        width: row.barWidth,
        height: 24
      }}
      onPointerDown={(event) => {
        if (!editing || linkMode !== "none") return;
        // Skip when the click originated on a resize handle.
        const target = event.target as HTMLElement;
        if (target.closest(".screen-gantt-resize-handle")) return;
        event.preventDefault();
        onPointerDown(node, event, row);
      }}
      onClick={() => {
        if (linkMode !== "none") {
          onLinkNode(node.id);
          return;
        }
        onSelect(node.id);
      }}
      onDoubleClick={() => onOpenDetail(node.id)}
      onPointerEnter={() => {
        if (linkMode === "none") onHoverNode(node.id);
      }}
      onPointerLeave={() => onHoverNode(undefined)}
    >
      <span className="screen-gantt-task-bar-progress" style={{ width: `${progressPercent}%` }} />
      {editing ? (
        <span
          className="screen-gantt-resize-handle start"
          onPointerDown={(event) => beginResize("start", event)}
        />
      ) : null}
      <strong>{node.title}</strong>
      <small>{node.progress}%</small>
      {node.isBlocked ? <span className="screen-gantt-node-flag blocked">阻塞</span> : null}
      {hasActualDelay ? <span className="screen-gantt-node-flag delay">Delay</span> : null}
      {node.riskLevel === "high" ? <span className="screen-gantt-node-flag risk">高风险</span> : null}
      {editing ? (
        <span
          className="screen-gantt-resize-handle end"
          onPointerDown={(event) => beginResize("end", event)}
        />
      ) : null}
      <NodePopover
        node={node}
        kindLabel="任务区间"
        dateLabel={`${formatDateLabel(row.startIso)} → ${formatDateLabel(row.endIso)}`}
        emptyText="该任务暂未拆分子任务项"
        open={popoverOpen}
        hasDependency={hasDependency}
      />
    </div>
  );
}

function NodePopover({
  node,
  kindLabel,
  dateLabel,
  emptyText,
  open,
  hasDependency,
  variant
}: {
  node: PlanNode;
  kindLabel: string;
  dateLabel: string;
  emptyText: string;
  open: boolean;
  hasDependency: boolean;
  variant?: "milestone";
}) {
  const indexLabel = /^[MT]\d+$/i.test(node.label) ? node.label : "";
  return (
    <div
      className={`screen-gantt-popover${variant ? ` ${variant}` : ""}`}
      role="presentation"
      aria-hidden={!open}
    >
      <header className="screen-gantt-popover-header">
        <span className={`screen-gantt-popover-kind ${variant ?? "task"}`}>{kindLabel}</span>
        {indexLabel ? <span className="screen-gantt-popover-index">{indexLabel}</span> : null}
      </header>
      <strong>{node.title}</strong>
      <p>{dateLabel}</p>
      <ul className="screen-gantt-popover-tags">
        <li className={`difficulty ${node.difficulty}`}>{difficultyLabel(node.difficulty)}</li>
        <li>{node.ownerLabel ?? "未分配负责人"}</li>
        <li>进度 {node.progress}%</li>
        {typeof node.estimateHours === "number" ? <li>预估 {node.estimateHours}h</li> : null}
        {hasDependency ? <li className="dependency">依赖</li> : null}
        {node.isOnCriticalPath ? <li className="critical">关键路径</li> : null}
        {node.riskLevel ? <li className={`risk ${node.riskLevel}`}>{riskLabel(node.riskLevel)}</li> : null}
        {node.isBlocked ? <li className="blocked">阻塞</li> : null}
        {(node.directDelayDays ?? 0) > 0 ? <li className="delay">Delay +{node.directDelayDays}天</li> : null}
        {(node.propagatedDelayDays ?? 0) > 0 ? (
          <li className={`dependency${node.absorbedUpstreamDelay ? " absorbed" : ""}`}>
            受依赖影响 +{node.propagatedDelayDays}天
          </li>
        ) : null}
        {node.absorbedUpstreamDelay ? (
          <li className="absorbed" title="本节点按原计划完成，已截断上游 Delay 传播">
            不受依赖 Delay 影响
          </li>
        ) : null}
      </ul>
      {node.tasks.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        <>
          <small className="screen-gantt-popover-count">挂载任务 {node.tasks.length} 项</small>
          <ul className="screen-gantt-popover-tasks">
            {node.tasks.map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                <em>{task.ownerLabel} · {task.progress}%</em>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function riskLabel(value: NonNullable<PlanNode["riskLevel"]>): string {
  if (value === "high") return "高风险";
  if (value === "medium") return "中风险";
  return "低风险";
}

/**
 * Counts business-day (Mon–Fri) inclusive between two ISO dates, used by the
 * resize floating tooltip so the user sees how many workdays the new
 * interval covers.
 */
function countWorkdays(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const final = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  let count = 0;
  while (cursor <= final) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Reads the canvas zoom factor from the CSS variable set by useScreenScale,
 * so resize math keeps 1:1 with mouse motion regardless of viewport scale.
 */
function getScaleFromTransform(event: ReactPointerEvent<HTMLSpanElement>): number {
  const canvas = event.currentTarget.closest(".big-screen-canvas") as HTMLElement | null;
  if (!canvas) return 1;
  const transform = window.getComputedStyle(canvas).transform;
  if (!transform || transform === "none") return 1;
  const match = transform.match(/matrix\(([-0-9.]+)/);
  return match ? parseFloat(match[1]) : 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function MilestoneMark({
  row,
  timeline,
  selected,
  hasDependency,
  linkMode,
  linkSource,
  popoverOpen,
  dragging,
  editing,
  onSelect,
  onLinkNode,
  onOpenDetail,
  onPointerDown,
  onHoverNode
}: {
  row: Extract<GanttRow, { kind: "milestone" }>;
  timeline: TimelineWindow;
  selected: boolean;
  hasDependency: boolean;
  linkMode: LinkMode;
  linkSource: boolean;
  popoverOpen: boolean;
  dragging: boolean;
  editing: boolean;
  onSelect: (nodeId: string) => void;
  onLinkNode: (nodeId: string) => void;
  onOpenDetail: (nodeId: string) => void;
  onPointerDown: (
    node: PlanNode,
    event: ReactPointerEvent<HTMLDivElement>,
    row: GanttRow
  ) => void;
  onHoverNode: (nodeId: string | undefined) => void;
}) {
  const node = row.node;
  const center = timeline.dateToPixel(node.date);
  const hasActualDelay = (node.directDelayDays ?? node.delayDays ?? 0) > 0;
  const SIZE = 20;
  return (
    <div
      className={`screen-gantt-milestone ${node.difficulty}`}
      data-selected={selected}
      data-link-source={linkSource || undefined}
      data-popover-open={popoverOpen}
      data-dragging={dragging}
      data-critical={node.isOnCriticalPath}
      data-risk={node.riskLevel}
      data-blocked={node.isBlocked || undefined}
      data-delay={hasActualDelay || undefined}
      style={{
        transform: `translate3d(${center - SIZE / 2}px, ${row.top + (row.height - SIZE) / 2}px, 0)`,
        width: SIZE,
        height: SIZE
      }}
      onPointerDown={(event) => {
        if (!editing || linkMode !== "none") return;
        event.preventDefault();
        onPointerDown(node, event, row);
      }}
      onClick={() => {
        if (linkMode !== "none") {
          onLinkNode(node.id);
          return;
        }
        onSelect(node.id);
      }}
      onDoubleClick={() => onOpenDetail(node.id)}
      onPointerEnter={() => onHoverNode(node.id)}
      onPointerLeave={() => onHoverNode(undefined)}
    >
      <span className="screen-gantt-milestone-shape" aria-hidden />
      {node.isBlocked ? <span className="screen-gantt-milestone-flag blocked">阻塞</span> : null}
      <span className="screen-gantt-milestone-label">{node.label}</span>
      <span className="screen-gantt-milestone-date">{formatDateLabel(node.date)}</span>
      <NodePopover
        node={node}
        kindLabel="关键节点"
        dateLabel={formatDateLabel(node.date)}
        emptyText="阶段性验收节点，未挂接任务项"
        open={popoverOpen}
        hasDependency={hasDependency}
        variant="milestone"
      />
    </div>
  );
}

function BaselineGhostLayer({
  plan,
  baselinePlan,
  timeline
}: {
  plan: PlanModel;
  baselinePlan: PlanModel | null;
  timeline: TimelineWindow;
}) {
  if (!baselinePlan) return null;
  const baselineByWp = new Map<number, PlanNode>();
  const baselineById = new Map<string, PlanNode>();
  for (const node of baselinePlan.nodes) {
    if (typeof node.workPackageId === "number") baselineByWp.set(node.workPackageId, node);
    baselineById.set(node.id, node);
  }

  return (
    <>
      {plan.nodes.map((node) => {
        const baseline =
          (typeof node.workPackageId === "number" && baselineByWp.get(node.workPackageId)) ||
          baselineById.get(node.id);
        if (!baseline) return null;
        if (baseline.date === node.date) return null;
        const row = timeline.rows.find((entry) => entry.kind !== "phase" && entry.id === node.id);
        if (!row || row.kind === "phase") return null;
        if (node.shape === "task" && baseline.startDate && baseline.endDate) {
          const left = timeline.dateToPixel(baseline.startDate);
          const right = timeline.dateToPixel(baseline.endDate);
          return (
            <div
              key={`ghost-${node.id}`}
              className="screen-baseline-ghost task"
              style={{
                left,
                top: row.top + (row.height - 24) / 2,
                width: Math.max(40, right - left),
                height: 24
              }}
              title={`基线：${formatDateLabel(baseline.startDate)} → ${formatDateLabel(baseline.endDate)}`}
            />
          );
        }
        const baselineLeft = timeline.dateToPixel(baseline.date) - 10;
        return (
          <div
            key={`ghost-${node.id}`}
            className="screen-baseline-ghost milestone"
            style={{ left: baselineLeft, top: row.top + (row.height - 20) / 2, width: 20, height: 20 }}
            title={`基线：${formatDateLabel(baseline.date)}`}
          />
        );
      })}
    </>
  );
}

function hitTestDependencyLine(
  plan: PlanModel,
  timeline: TimelineWindow,
  x: number,
  y: number
): string | undefined {
  if (plan.dependencies.length === 0) return undefined;
  const rowIndex = new Map(timeline.rows.map((row) => [row.id, row] as const));
  let best: { key: string; distance: number } | undefined;

  for (const dependency of plan.dependencies) {
    const meta = dependencyMetaFor(
      rowIndex,
      timeline,
      dependency.fromNodeId,
      dependency.toNodeId
    );
    if (!meta) continue;
    const shape = buildDependencyShape(meta);
    const distance = distanceToShape(shape.segments, { x, y });
    if (distance > 10) continue;
    if (!best || distance < best.distance) {
      best = { key: `${dependency.fromNodeId}->${dependency.toNodeId}`, distance };
    }
  }

  return best?.key;
}

/** Visible gap between the line endpoint and the node edge. Keeps the
 * source dot and the arrow tip clear of the node body so the connection is
 * obviously attached at both ends without being clipped or overlapped. */
const DEPENDENCY_NODE_GAP = 6;
/** Length of the horizontal stem leaving the source and entering the target. */
const DEPENDENCY_STEM = 16;

interface DepPoint {
  x: number;
  y: number;
}

interface DepMeta {
  from: DepPoint;
  to: DepPoint;
}

interface DepShape {
  d: string;
  /** Polyline approximation of the path used by hit-testing. */
  segments: Array<{ a: DepPoint; b: DepPoint }>;
}

/**
 * Computes the line endpoints (with the visible gap) outside both bars so
 * head and arrow markers stay clear of the node bodies.
 */
function dependencyMetaFor(
  rowIndex: Map<string, GanttRow>,
  timeline: TimelineWindow,
  fromNodeId: string,
  toNodeId: string
): DepMeta | null {
  const fromRow = rowIndex.get(fromNodeId);
  const toRow = rowIndex.get(toNodeId);
  if (!fromRow || !toRow) return null;
  if (fromRow.kind === "phase" || toRow.kind === "phase") return null;

  let sourceRight: number;
  if (fromRow.kind === "task") {
    sourceRight = fromRow.barLeft + fromRow.barWidth;
  } else {
    sourceRight = timeline.dateToPixel(fromRow.node.date) + 10;
  }
  let targetLeft: number;
  if (toRow.kind === "task") {
    targetLeft = toRow.barLeft;
  } else {
    targetLeft = timeline.dateToPixel(toRow.node.date) - 10;
  }
  const from: DepPoint = {
    x: sourceRight + DEPENDENCY_NODE_GAP,
    y: fromRow.top + fromRow.height / 2
  };
  const to: DepPoint = {
    x: targetLeft - DEPENDENCY_NODE_GAP,
    y: toRow.top + toRow.height / 2
  };
  return { from, to };
}

/**
 * Always renders a smooth cubic Bezier with horizontal stems at both ends.
 * Control points are pulled outward in the +x and -x directions so that:
 *   - For "forward" deps (target right of source) we get the natural S-curve.
 *   - For "backward / overlap" deps the curve sweeps in a wide arc; combined
 *     with the dependency layer sitting above all node bars (z-index: 32) and
 *     the visible end-gap, the curve may pass over node bodies but the head
 *     and arrow always remain unobstructed.
 */
function buildDependencyShape(meta: DepMeta): DepShape {
  const stem = DEPENDENCY_STEM;
  const a: DepPoint = { x: meta.from.x + stem, y: meta.from.y };
  const b: DepPoint = { x: meta.to.x - stem, y: meta.to.y };
  const span = Math.abs(b.x - a.x);
  const dx = Math.max(56, span * 0.55);
  const c1: DepPoint = { x: a.x + dx, y: a.y };
  const c2: DepPoint = { x: b.x - dx, y: b.y };

  const segments: Array<{ a: DepPoint; b: DepPoint }> = [];
  segments.push({ a: meta.from, b: a });
  let previous: DepPoint = a;
  for (let i = 1; i <= 24; i += 1) {
    const current = cubicPoint(a, c1, c2, b, i / 24);
    segments.push({ a: previous, b: current });
    previous = current;
  }
  segments.push({ a: b, b: meta.to });
  const d =
    `M${meta.from.x},${meta.from.y} L${a.x},${a.y}` +
    ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}` +
    ` L${meta.to.x},${meta.to.y}`;
  return { d, segments };
}

function distanceToShape(
  segments: Array<{ a: DepPoint; b: DepPoint }>,
  point: DepPoint
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const segment of segments) {
    best = Math.min(best, distanceToSegment(point, segment.a, segment.b));
  }
  return best;
}

function cubicPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y
  };
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function DependencyLayer({
  plan,
  timeline,
  selectedDependencyKey
}: {
  plan: PlanModel;
  timeline: TimelineWindow;
  selectedDependencyKey?: string;
}) {
  const rowIndex = new Map(timeline.rows.map((row) => [row.id, row] as const));
  const nodeById = new Map(plan.nodes.map((node) => [node.id, node] as const));
  if (plan.dependencies.length === 0) return null;

  return (
    <>
      <svg
        className="screen-dependency-layer"
        width={timeline.canvasWidth}
        height={timeline.totalHeight}
      >
        {plan.dependencies.map((dependency, index) => {
          const meta = dependencyMetaFor(
            rowIndex,
            timeline,
            dependency.fromNodeId,
            dependency.toNodeId
          );
          if (!meta) return null;
          const shape = buildDependencyShape(meta);
          const dependencyKey = `${dependency.fromNodeId}->${dependency.toNodeId}`;
          const sourceNode = nodeById.get(dependency.fromNodeId);
          const absorbed = Boolean(sourceNode?.absorbedUpstreamDelay);
          const baseClass = dependency.isCritical ? "critical" : "dependency";
          const classes = [baseClass];
          if (absorbed) classes.push("absorbed");
          if (selectedDependencyKey === dependencyKey) classes.push("selected");
          const markerEnd = absorbed
            ? dependency.isCritical
              ? "url(#screen-critical-absorbed-arrow)"
              : "url(#screen-dep-absorbed-arrow)"
            : dependency.isCritical
              ? "url(#screen-critical-arrow)"
              : "url(#screen-dep-arrow)";
          const markerStart = absorbed
            ? dependency.isCritical
              ? "url(#screen-critical-absorbed-source)"
              : "url(#screen-dep-absorbed-source)"
            : dependency.isCritical
              ? "url(#screen-critical-source)"
              : "url(#screen-dep-source)";
          return (
            <path
              key={`dep-${index}-${dependency.fromNodeId}-${dependency.toNodeId}`}
              className={classes.join(" ")}
              d={shape.d}
              fill="none"
              markerStart={markerStart}
              markerEnd={markerEnd}
            />
          );
        })}
        <defs>
          {/* End arrows — refX equals markerWidth so the arrow tip lands
              exactly on the path endpoint instead of poking past it. */}
          <marker
            id="screen-dep-arrow"
            markerWidth={7}
            markerHeight={7}
            refX={7}
            refY={3.5}
            orient="auto"
          >
            <path d="M0,0 L7,3.5 L0,7 L1.5,3.5 z" fill="rgba(226, 232, 240, 0.98)" />
          </marker>
          <marker
            id="screen-critical-arrow"
            markerWidth={6}
            markerHeight={6}
            refX={6}
            refY={3}
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 L1.3,3 z" fill="rgba(248, 113, 113, 0.98)" />
          </marker>
          <marker
            id="screen-dep-absorbed-arrow"
            markerWidth={7}
            markerHeight={7}
            refX={7}
            refY={3.5}
            orient="auto"
          >
            <path d="M0,0 L7,3.5 L0,7 L1.5,3.5 z" fill="rgba(134, 239, 172, 0.98)" />
          </marker>
          <marker
            id="screen-critical-absorbed-arrow"
            markerWidth={6}
            markerHeight={6}
            refX={6}
            refY={3}
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 L1.3,3 z" fill="rgba(134, 239, 172, 0.98)" />
          </marker>
          {/* Source dots — refX/refY at marker center so the dot is centered
              on the line origin, just outside the source node. */}
          <marker
            id="screen-dep-source"
            markerWidth={5}
            markerHeight={5}
            refX={2.5}
            refY={2.5}
            orient="auto"
          >
            <circle cx={2.5} cy={2.5} r={1.8} fill="rgba(226, 232, 240, 0.98)" />
          </marker>
          <marker
            id="screen-critical-source"
            markerWidth={5}
            markerHeight={5}
            refX={2.5}
            refY={2.5}
            orient="auto"
          >
            <circle cx={2.5} cy={2.5} r={2} fill="rgba(248, 113, 113, 0.98)" />
          </marker>
          <marker
            id="screen-dep-absorbed-source"
            markerWidth={5}
            markerHeight={5}
            refX={2.5}
            refY={2.5}
            orient="auto"
          >
            <circle cx={2.5} cy={2.5} r={1.8} fill="rgba(134, 239, 172, 0.98)" />
          </marker>
          <marker
            id="screen-critical-absorbed-source"
            markerWidth={5}
            markerHeight={5}
            refX={2.5}
            refY={2.5}
            orient="auto"
          >
            <circle cx={2.5} cy={2.5} r={2} fill="rgba(134, 239, 172, 0.98)" />
          </marker>
        </defs>
      </svg>
    </>
  );
}

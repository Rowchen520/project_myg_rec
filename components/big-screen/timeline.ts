import type { PlanModel, PlanNode, PlanPhase } from "@/lib/services/big-screen-plan";

export const DAY_MS = 86_400_000;
export const SIDEBAR_WIDTH = 320;

/** Default duration assumed when a task node only carries a single date. */
export const DEFAULT_TASK_DURATION_DAYS = 7;
export const PHASE_ROW_HEIGHT = 36;
export const TASK_ROW_HEIGHT = 40;
export const MILESTONE_ROW_HEIGHT = 32;
export const HEADER_ROW_HEIGHT = 36;

export type ZoomLevel = "day" | "week" | "month" | "quarter";

/**
 * Pixels per day at each zoom level. Larger values "zoom in" and show daily
 * detail; smaller values fit a longer span on screen.
 */
export const PIXELS_PER_DAY_BY_ZOOM: Record<ZoomLevel, number> = {
  day: 24,
  week: 8,
  month: 3,
  quarter: 1.5
};

export interface TimelineMonth {
  key: string;
  label: string;
  year: number;
  left: number;
  width: number;
  weeks: TimelineWeek[];
}

export interface TimelineWeek {
  key: string;
  left: number;
  width: number;
  isWeekend: boolean;
}

/**
 * One visible row in the gantt grid. Rows are vertically stacked and each row
 * appears both in the left "name" column and the right time canvas at the
 * same `top` coordinate.
 */
export type GanttRow =
  | {
      kind: "phase";
      id: string;
      top: number;
      height: number;
      phase: PlanPhase;
      /** Index inside the phase array, used for color rotation. */
      colorIndex: number;
    }
  | {
      kind: "task";
      id: string;
      top: number;
      height: number;
      node: PlanNode;
      phase: PlanPhase;
      /** Pre-computed left/width inside the canvas in px. */
      barLeft: number;
      barWidth: number;
      /** Resolved start/end ISO dates (after applying defaults). */
      startIso: string;
      endIso: string;
      colorIndex: number;
    }
  | {
      kind: "milestone";
      id: string;
      top: number;
      height: number;
      node: PlanNode;
      phase: PlanPhase;
      colorIndex: number;
    };

export interface TimelineWindow {
  start: Date;
  end: Date;
  totalDays: number;
  canvasWidth: number;
  pixelsPerDay: number;
  zoom: ZoomLevel;
  todayLeft: number;
  months: TimelineMonth[];
  /** Lookup helper: convert ISO date to absolute pixel inside the canvas. */
  dateToPixel: (value: string) => number;
  /** Lookup helper: convert absolute pixel back to ISO string. */
  pixelToDate: (pixel: number) => string;
  /** Linear list of rows (phase / task / milestone) for table layout. */
  rows: GanttRow[];
  /** Total height of the gantt body (sum of all row heights). */
  totalHeight: number;
}

export interface TimelineExpansion {
  startOffsetDays: number;
  endOffsetDays: number;
}

/**
 * Per-zoom minimum visible span in days. Picking these explicitly means
 * "month" or "quarter" zooms always show at least a full year (or two), so
 * the canvas does not collapse into a tiny strip when the project itself
 * spans only a few weeks.
 */
const MIN_SPAN_DAYS_BY_ZOOM: Record<ZoomLevel, number> = {
  day: 60,
  week: 365,
  month: 365,
  quarter: 730
};

/**
 * Computes the timeline window + per-phase row layout.
 *
 * Rows are vertically stacked by phase, then by node date, so the left task
 * list and the right gantt canvas can share the same absolute row baseline.
 */
export function buildTimelineWindow(
  plan: PlanModel,
  expansion: TimelineExpansion,
  zoom: ZoomLevel = "week"
): TimelineWindow {
  const pixelsPerDay = PIXELS_PER_DAY_BY_ZOOM[zoom];
  const dates = collectDates(plan);
  const min = dates.length ? Math.min(...dates) : new Date(plan.startDate).getTime();
  const max = dates.length ? Math.max(...dates) : new Date(plan.endDate).getTime();

  const startBase = new Date(min);
  const endBase = new Date(max);
  startBase.setDate(startBase.getDate() - 14 - Math.max(0, expansion.startOffsetDays));
  endBase.setDate(endBase.getDate() + 14 + Math.max(0, expansion.endOffsetDays));

  // Snap to month boundaries first, then – if the natural project span is
  // shorter than the chosen density's minimum window – expand the right
  // edge so today + project nodes stay anchored to the left while the user
  // still sees the configured horizon (default ~1 year for week/month).
  let start = new Date(startBase.getFullYear(), startBase.getMonth(), 1);
  let end = new Date(endBase.getFullYear(), endBase.getMonth() + 1, 0, 23, 59, 59);
  const minSpanDays = MIN_SPAN_DAYS_BY_ZOOM[zoom];
  let span = (end.getTime() - start.getTime()) / DAY_MS;
  if (span < minSpanDays) {
    const expandedEnd = new Date(start);
    expandedEnd.setDate(expandedEnd.getDate() + minSpanDays);
    end = new Date(expandedEnd.getFullYear(), expandedEnd.getMonth() + 1, 0, 23, 59, 59);
    span = (end.getTime() - start.getTime()) / DAY_MS;
  }
  const totalDays = Math.max(1, span);
  const canvasWidth = totalDays * pixelsPerDay;

  const months = buildMonths(start, end, pixelsPerDay);
  const today = new Date(plan.today);
  const todayLeft = clamp(((today.getTime() - start.getTime()) / DAY_MS) * pixelsPerDay, 0, canvasWidth);

  const dateToPixel = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return clamp(((date.getTime() - start.getTime()) / DAY_MS) * pixelsPerDay, 0, canvasWidth);
  };

  const pixelToDate = (pixel: number) => {
    const days = pixel / pixelsPerDay;
    const ms = start.getTime() + days * DAY_MS;
    return new Date(ms).toISOString();
  };

  const rows: GanttRow[] = [];
  let cursorTop = 0;

  const sortedPhases = plan.phases
    .slice()
    .sort(
      (left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
    );

  sortedPhases.forEach((phase, phaseIndex) => {
    rows.push({
      kind: "phase",
      id: phase.id,
      top: cursorTop,
      height: PHASE_ROW_HEIGHT,
      phase,
      colorIndex: phaseIndex
    });
    cursorTop += PHASE_ROW_HEIGHT;

    const phaseNodes = plan.nodes
      .filter((node) => node.phaseId === phase.id)
      .slice()
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

    for (const node of phaseNodes) {
      if (node.shape === "milestone") {
        rows.push({
          kind: "milestone",
          id: node.id,
          top: cursorTop,
          height: MILESTONE_ROW_HEIGHT,
          node,
          phase,
          colorIndex: phaseIndex
        });
        cursorTop += MILESTONE_ROW_HEIGHT;
      } else {
        const startIso = node.startDate ?? node.date;
        const startPx = dateToPixel(startIso);
        const endIso = node.endDate ?? addDaysIso(startIso, DEFAULT_TASK_DURATION_DAYS);
        // Use the real pixel range so resize results stay put. CSS provides
        // a small visual `min-width` so single-day bars remain clickable
        // without distorting the underlying date.
        const endPx = Math.max(startPx + 4, dateToPixel(endIso));
        rows.push({
          kind: "task",
          id: node.id,
          top: cursorTop,
          height: TASK_ROW_HEIGHT,
          node,
          phase,
          barLeft: startPx,
          barWidth: endPx - startPx,
          startIso,
          endIso,
          colorIndex: phaseIndex
        });
        cursorTop += TASK_ROW_HEIGHT;
      }
    }
  });

  return {
    start,
    end,
    totalDays,
    canvasWidth,
    pixelsPerDay,
    zoom,
    todayLeft,
    months,
    dateToPixel,
    pixelToDate,
    rows,
    totalHeight: cursorTop
  };
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function collectDates(plan: PlanModel): number[] {
  const values: number[] = [];
  values.push(new Date(plan.startDate).getTime(), new Date(plan.endDate).getTime());
  for (const phase of plan.phases) {
    values.push(new Date(phase.startDate).getTime(), new Date(phase.endDate).getTime());
  }
  for (const node of plan.nodes) {
    values.push(new Date(node.date).getTime());
    if (node.startDate) values.push(new Date(node.startDate).getTime());
    if (node.endDate) values.push(new Date(node.endDate).getTime());
  }
  return values.filter((value) => Number.isFinite(value));
}

function buildMonths(start: Date, end: Date, pixelsPerDay: number): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: `${cursor.getMonth() + 1}月`,
      year: cursor.getFullYear(),
      left: ((monthStart.getTime() - start.getTime()) / DAY_MS) * pixelsPerDay,
      width: ((monthEnd.getTime() - monthStart.getTime()) / DAY_MS) * pixelsPerDay,
      weeks: pixelsPerDay >= 4 ? buildWeekStripes(monthStart, monthEnd, start, pixelsPerDay) : []
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function buildWeekStripes(
  monthStart: Date,
  monthEnd: Date,
  originStart: Date,
  pixelsPerDay: number
): TimelineWeek[] {
  const stripes: TimelineWeek[] = [];
  const cursor = new Date(monthStart);
  while (cursor < monthEnd) {
    const dayOfWeek = cursor.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);
    dayEnd.setDate(dayEnd.getDate() + 1);
    stripes.push({
      key: `${dayStart.getTime()}`,
      left: ((dayStart.getTime() - originStart.getTime()) / DAY_MS) * pixelsPerDay,
      width: ((dayEnd.getTime() - dayStart.getTime()) / DAY_MS) * pixelsPerDay,
      isWeekend
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return stripes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

export function difficultyLabel(value: string): string {
  return { low: "低难度", medium: "中等", high: "困难", critical: "高风险难点" }[value] ?? value;
}

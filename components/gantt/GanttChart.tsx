import { EmptyState } from "@/components/primer/EmptyState";
import { typeLabel } from "@/lib/work-package-presentation";
import type { Person, WorkPackage } from "@/lib/types";

interface GanttChartProps {
  workPackages: WorkPackage[];
  people: Person[];
  /** ISO timestamp considered "now". Server-rendered to keep this component pure. */
  now?: string;
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 32;
const LEFT_LABEL_WIDTH = 240;
const DAY_WIDTH = 22;

const TYPE_FILL: Record<string, string> = {
  task: "var(--accent-fg)",
  milestone: "var(--done-fg)",
  risk: "var(--danger-fg)",
  phase: "var(--attention-fg)"
};

const TYPE_BG: Record<string, string> = {
  task: "rgba(37, 99, 235, 0.12)",
  milestone: "rgba(124, 58, 237, 0.12)",
  risk: "rgba(220, 38, 38, 0.12)",
  phase: "rgba(217, 119, 6, 0.12)"
};

interface GanttRow {
  workPackage: WorkPackage;
  startOffsetDays: number;
  durationDays: number;
}

/**
 * Lightweight Gantt timeline rendered as SVG. Computes a simple time window
 * from the work-package date range, draws a label column, month markers, a
 * "today" line and one rectangular bar per work-package with progress fill.
 */
export function GanttChart({ workPackages, people, now }: GanttChartProps) {
  const dated = workPackages.filter((wp) => wp.dueDate || wp.startDate);
  if (dated.length === 0) {
    return (
      <EmptyState
        title="工作项缺少日期"
        description="给至少一个工作项设置开始或截止日期，时间线会自动出现。"
      />
    );
  }

  const personLookup = new Map(people.map((person) => [person.id, person]));
  const allDates = dated
    .flatMap((wp) => [wp.startDate, wp.dueDate])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime());
  const earliest = new Date(Math.min(...allDates));
  const latest = new Date(Math.max(...allDates));
  earliest.setUTCHours(0, 0, 0, 0);
  earliest.setUTCDate(earliest.getUTCDate() - 3);
  const totalDays = Math.max(
    1,
    Math.ceil((latest.getTime() - earliest.getTime()) / (24 * 3600 * 1000)) + 7
  );

  const rows: GanttRow[] = dated.map((wp) => {
    const start = wp.startDate ? new Date(wp.startDate) : new Date(wp.dueDate!);
    const end = wp.dueDate ? new Date(wp.dueDate) : new Date(start.getTime() + 24 * 3600 * 1000);
    const startOffset = Math.max(
      0,
      Math.floor((start.getTime() - earliest.getTime()) / (24 * 3600 * 1000))
    );
    const duration = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (24 * 3600 * 1000))
    );
    return { workPackage: wp, startOffsetDays: startOffset, durationDays: duration };
  });

  const width = LEFT_LABEL_WIDTH + totalDays * DAY_WIDTH;
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 8;

  const monthMarkers: Array<{ x: number; label: string }> = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(earliest.getTime() + i * 24 * 3600 * 1000);
    if (date.getUTCDate() === 1 || i === 0) {
      monthMarkers.push({
        x: LEFT_LABEL_WIDTH + i * DAY_WIDTH,
        label: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
      });
    }
  }

  const todayMs = now ? new Date(now).getTime() : NaN;
  const todayOffset =
    Number.isFinite(todayMs) &&
    todayMs >= earliest.getTime() &&
    todayMs <= earliest.getTime() + totalDays * 24 * 3600 * 1000
      ? LEFT_LABEL_WIDTH +
        Math.floor((todayMs - earliest.getTime()) / (24 * 3600 * 1000)) * DAY_WIDTH
      : null;

  return (
    <div className="scroll-x">
      <svg width={width} height={height} role="img" aria-label="项目甘特图">
        {/* Header background */}
        <rect x={0} y={0} width={width} height={HEADER_HEIGHT} fill="var(--bg-subtle)" />
        <line
          x1={0}
          y1={HEADER_HEIGHT}
          x2={width}
          y2={HEADER_HEIGHT}
          stroke="var(--border-default)"
        />
        {/* Label divider */}
        <line
          x1={LEFT_LABEL_WIDTH}
          y1={0}
          x2={LEFT_LABEL_WIDTH}
          y2={height}
          stroke="var(--border-default)"
        />
        {/* Month markers */}
        {monthMarkers.map((marker) => (
          <g key={marker.x}>
            <line
              x1={marker.x}
              y1={HEADER_HEIGHT}
              x2={marker.x}
              y2={height}
              stroke="var(--border-muted)"
            />
            <text x={marker.x + 6} y={20} fontSize={11} fill="var(--fg-muted)" fontWeight={500}>
              {marker.label}
            </text>
          </g>
        ))}
        {/* Today line */}
        {todayOffset !== null ? (
          <g>
            <line
              x1={todayOffset}
              y1={HEADER_HEIGHT}
              x2={todayOffset}
              y2={height}
              stroke="var(--accent-fg)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <rect
              x={todayOffset - 18}
              y={HEADER_HEIGHT - 18}
              width={36}
              height={16}
              rx={4}
              fill="var(--accent-fg)"
            />
            <text
              x={todayOffset}
              y={HEADER_HEIGHT - 7}
              fontSize={10}
              fill="var(--fg-on-emphasis)"
              fontWeight={600}
              textAnchor="middle"
            >
              今天
            </text>
          </g>
        ) : null}
        {/* Rows */}
        {rows.map((row, index) => {
          const fill = TYPE_FILL[row.workPackage.type] ?? TYPE_FILL.task;
          const bg = TYPE_BG[row.workPackage.type] ?? TYPE_BG.task;
          const y = HEADER_HEIGHT + index * ROW_HEIGHT;
          const barX = LEFT_LABEL_WIDTH + row.startOffsetDays * DAY_WIDTH;
          const barWidth = Math.max(8, row.durationDays * DAY_WIDTH);
          const owner = row.workPackage.assigneeId
            ? personLookup.get(row.workPackage.assigneeId)?.name
            : undefined;
          const progressWidth = Math.max(0, (row.workPackage.percentComplete / 100) * barWidth);

          return (
            <g key={row.workPackage.id}>
              {index % 2 === 1 ? (
                <rect
                  x={LEFT_LABEL_WIDTH}
                  y={y}
                  width={width - LEFT_LABEL_WIDTH}
                  height={ROW_HEIGHT}
                  fill="var(--bg-subtle)"
                  opacity={0.4}
                />
              ) : null}
              {/* Label */}
              <text
                x={12}
                y={y + 16}
                fontSize={12}
                fill="var(--fg-default)"
                fontWeight={500}
              >
                <tspan className="mono" style={{ fill: "var(--fg-subtle)" }}>
                  #{row.workPackage.id}
                </tspan>{" "}
                {truncate(row.workPackage.subject, 20)}
              </text>
              <text x={12} y={y + 28} fontSize={10} fill="var(--fg-muted)">
                {typeLabel(row.workPackage.type)} · {owner ?? "未分配"}
              </text>
              {/* Bar */}
              <rect
                x={barX}
                y={y + 8}
                width={barWidth}
                height={20}
                rx={4}
                fill={bg}
                stroke={fill}
                strokeWidth={1}
              />
              <rect
                x={barX}
                y={y + 8}
                width={progressWidth}
                height={20}
                rx={4}
                fill={fill}
              />
              {barWidth >= 36 ? (
                <text
                  x={barX + barWidth - 6}
                  y={y + 21}
                  fontSize={10}
                  fontWeight={600}
                  fill={progressWidth > barWidth - 26 ? "var(--fg-on-emphasis)" : fill}
                  textAnchor="end"
                >
                  {row.workPackage.percentComplete}%
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

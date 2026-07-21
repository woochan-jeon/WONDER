import Link from "next/link";
import type { CalendarEvent } from "@/lib/google-calendar";
import { eventDayBounds, getMonthGrid, monthParam, shiftMonth, toDateKey } from "@/lib/calendar-grid";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_VISIBLE_LANES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Google Calendar's fixed event color palette (Colors API "event" set, colorId 1–11).
const EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6c026",
  "6": "#f5511d",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d60000",
};

function formatEventTime(event: CalendarEvent) {
  if (event.allDay || !event.start) return null;
  return new Date(event.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

type Segment = { event: CalendarEvent; startCol: number; span: number; lane: number };

/** Lays out one week's events into non-overlapping horizontal lanes, like Google Calendar's month view bars. */
function layoutWeek(week: Date[], events: CalendarEvent[]): Segment[] {
  const weekStart = week[0];
  const weekEnd = week[6];

  const raw: { event: CalendarEvent; startCol: number; span: number }[] = [];
  for (const event of events) {
    if (!event.start) continue;
    const { start, end } = eventDayBounds(event.start, event.end, event.allDay);
    if (end < weekStart || start > weekEnd) continue;

    const segStart = start < weekStart ? weekStart : start;
    const segEnd = end > weekEnd ? weekEnd : end;
    const startCol = Math.round((segStart.getTime() - weekStart.getTime()) / DAY_MS);
    const span = Math.round((segEnd.getTime() - segStart.getTime()) / DAY_MS) + 1;
    raw.push({ event, startCol, span });
  }

  // Earlier-starting, then longer events claim lanes first — keeps multi-day bars stable near the top.
  raw.sort((a, b) => a.startCol - b.startCol || b.span - a.span);

  const lanes: { startCol: number; span: number }[][] = [];
  const segments: Segment[] = [];
  for (const seg of raw) {
    let lane = lanes.findIndex(
      (existing) =>
        !existing.some((s) => seg.startCol < s.startCol + s.span && s.startCol < seg.startCol + seg.span),
    );
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push(seg);
    segments.push({ ...seg, lane });
  }
  return segments;
}

export default function CalendarMonthGrid({
  year,
  month,
  events,
  calendarColors,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  calendarColors?: Record<string, string>;
}) {
  const { weeks, firstOfMonth } = getMonthGrid(year, month);
  const todayKey = toDateKey(new Date());

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          {firstOfMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
        </h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/calendar?month=${monthParam(prev.year, prev.month)}`}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50"
          >
            ‹ 이전달
          </Link>
          <Link
            href="/calendar"
            className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50"
          >
            오늘
          </Link>
          <Link
            href={`/calendar?month=${monthParam(next.year, next.month)}`}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50"
          >
            다음달 ›
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`px-2 py-1.5 text-center text-xs font-medium ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-700"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {weeks.map((week) => {
          const segments = layoutWeek(week, events);
          const visible = segments.filter((s) => s.lane < MAX_VISIBLE_LANES);
          const hidden = segments.filter((s) => s.lane >= MAX_VISIBLE_LANES);
          const numLanes = Math.min(
            MAX_VISIBLE_LANES,
            segments.reduce((max, s) => Math.max(max, s.lane + 1), 0),
          );

          const overflowByCol = Array(7).fill(0);
          for (const s of hidden) {
            for (let c = s.startCol; c < s.startCol + s.span; c++) overflowByCol[c]++;
          }
          const hasOverflow = overflowByCol.some((n) => n > 0);
          const totalRows = 1 + numLanes + (hasOverflow ? 1 : 0);
          const weekKey = toDateKey(week[0]);

          return (
            <div
              key={weekKey}
              className="grid grid-cols-7 border-b border-gray-100 last:border-b-0"
              style={{ gridAutoRows: "min-content" }}
            >
              {week.map((day, i) => {
                const inMonth = day.getMonth() === month;
                return (
                  <div
                    key={toDateKey(day)}
                    style={{ gridColumn: i + 1, gridRow: `1 / span ${totalRows}`, minHeight: "5rem" }}
                    className={`border-r border-gray-100 last:border-r-0 ${inMonth ? "bg-white" : "bg-gray-50"}`}
                  />
                );
              })}

              {week.map((day, i) => {
                const key = toDateKey(day);
                const inMonth = day.getMonth() === month;
                const isToday = key === todayKey;
                return (
                  <div key={key} style={{ gridColumn: i + 1, gridRow: 1 }} className="p-1.5 pb-0.5">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        isToday
                          ? "bg-[#002D56] font-semibold text-white"
                          : inMonth
                            ? "text-gray-900"
                            : "text-gray-400"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}

              {visible.map((seg) => {
                const time = seg.span === 1 ? formatEventTime(seg.event) : null;
                const bg = seg.event.colorId
                  ? EVENT_COLORS[seg.event.colorId]
                  : calendarColors?.[seg.event.calendarId];
                return (
                  <a
                    key={`${seg.event.id}-${weekKey}`}
                    href={seg.event.htmlLink ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={seg.event.title}
                    style={{
                      gridColumn: `${seg.startCol + 1} / span ${seg.span}`,
                      gridRow: seg.lane + 2,
                      backgroundColor: bg ? `${bg}26` : undefined,
                    }}
                    className={`mx-0.5 mt-0.5 truncate rounded px-1 py-0.5 text-[11px] text-[#002D56] hover:opacity-80 ${
                      bg ? "" : "bg-[#002D56]/10"
                    }`}
                  >
                    {time && <span className="mr-1 font-medium">{time}</span>}
                    {seg.event.title}
                  </a>
                );
              })}

              {hasOverflow &&
                overflowByCol.map(
                  (count, i) =>
                    count > 0 && (
                      <span
                        key={`overflow-${weekKey}-${i}`}
                        style={{ gridColumn: i + 1, gridRow: numLanes + 2 }}
                        className="px-1.5 pb-1 text-[11px] text-gray-500"
                      >
                        +{count}개 더보기
                      </span>
                    ),
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

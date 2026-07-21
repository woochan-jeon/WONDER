import Link from "next/link";
import type { CalendarEvent } from "@/lib/google-calendar";
import {
  eventDateKeyRange,
  getMonthGrid,
  monthParam,
  shiftMonth,
  toDateKey,
} from "@/lib/calendar-grid";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_VISIBLE_EVENTS = 3;

// Google Calendar's fixed event color palette (Colors API "event" set, colorId 1–11).
const EVENT_COLORS: Record<string, { bg: string; fg: string }> = {
  "1": { bg: "#7986cb", fg: "#ffffff" },
  "2": { bg: "#33b679", fg: "#ffffff" },
  "3": { bg: "#8e24aa", fg: "#ffffff" },
  "4": { bg: "#e67c73", fg: "#ffffff" },
  "5": { bg: "#f6c026", fg: "#3c3c3c" },
  "6": { bg: "#f5511d", fg: "#ffffff" },
  "7": { bg: "#039be5", fg: "#ffffff" },
  "8": { bg: "#616161", fg: "#ffffff" },
  "9": { bg: "#3f51b5", fg: "#ffffff" },
  "10": { bg: "#0b8043", fg: "#ffffff" },
  "11": { bg: "#d60000", fg: "#ffffff" },
};

function formatEventTime(event: CalendarEvent) {
  if (event.allDay || !event.start) return null;
  return new Date(event.start).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarMonthGrid({
  year,
  month,
  events,
  defaultColor,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  defaultColor?: string | null;
}) {
  const { weeks, firstOfMonth } = getMonthGrid(year, month);
  const todayKey = toDateKey(new Date());

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (!event.start) continue;
    for (const key of eventDateKeyRange(event.start, event.end, event.allDay)) {
      if (!eventsByDay.has(key)) eventsByDay.set(key, []);
      eventsByDay.get(key)!.push(event);
    }
  }

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

        <div className="grid grid-cols-7">
          {weeks.flatMap((week) =>
            week.map((day) => {
              const key = toDateKey(day);
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = day.getMonth() === month;
              const isToday = key === todayKey;
              const overflow = dayEvents.length - MAX_VISIBLE_EVENTS;

              return (
                <div
                  key={key}
                  className={`flex min-h-[6.5rem] flex-col gap-0.5 border-b border-r border-gray-100 p-1.5 last:border-r-0 ${
                    inMonth ? "bg-white" : "bg-gray-50"
                  }`}
                >
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
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => {
                      const time = formatEventTime(event);
                      const color = event.colorId
                        ? EVENT_COLORS[event.colorId]
                        : defaultColor
                          ? { bg: defaultColor, fg: "#ffffff" }
                          : null;
                      return (
                        <a
                          key={`${event.id}-${key}`}
                          href={event.htmlLink ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={event.title}
                          style={
                            color
                              ? { backgroundColor: `${color.bg}26`, color: color.bg }
                              : undefined
                          }
                          className={`truncate rounded px-1 py-0.5 text-[11px] hover:opacity-80 ${
                            color ? "" : "bg-[#002D56]/10 text-[#002D56]"
                          }`}
                        >
                          {time && <span className="mr-1 font-medium">{time}</span>}
                          {event.title}
                        </a>
                      );
                    })}
                    {overflow > 0 && (
                      <span className="px-1 text-[11px] text-gray-500">+{overflow}개 더보기</span>
                    )}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

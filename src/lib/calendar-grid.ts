function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local-date key for a Google Calendar event's ISO datetime or all-day date string. */
export function eventDateKey(isoOrDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  return toDateKey(new Date(isoOrDate));
}

/**
 * The local start/end days (inclusive, at midnight) an event spans. Google
 * Calendar's `end` for all-day events is exclusive (a 3-day event has
 * end.date = day after the last day), so that case drops the last day;
 * timed events keep both ends.
 */
export function eventDayBounds(start: string, end: string | null, allDay: boolean): { start: Date; end: Date } {
  const startDate = new Date(`${eventDateKey(start)}T00:00:00`);
  if (!end) return { start: startDate, end: startDate };

  const endDate = new Date(`${eventDateKey(end)}T00:00:00`);
  if (allDay) endDate.setDate(endDate.getDate() - 1);

  return endDate < startDate ? { start: startDate, end: startDate } : { start: startDate, end: endDate };
}

export function parseMonthParam(param: string | undefined) {
  const today = new Date();
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  return { year: today.getFullYear(), month: today.getMonth() };
}

export function monthParam(year: number, month: number) {
  return `${year}-${pad(month + 1)}`;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Returns the full calendar grid (Sun–Sat weeks) covering the given month, padded with adjacent days. */
export function getMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return { weeks, gridStart, gridEnd, firstOfMonth, lastOfMonth };
}

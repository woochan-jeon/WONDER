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
 * All local-date keys an event spans, inclusive. Google Calendar's `end` for
 * all-day events is exclusive (a 3-day event has end.date = day after the
 * last day), so that case drops the last day; timed events keep both ends.
 */
export function eventDateKeyRange(start: string, end: string | null, allDay: boolean): string[] {
  const startKey = eventDateKey(start);
  if (!end) return [startKey];

  const startDate = new Date(`${startKey}T00:00:00`);
  const endKey = eventDateKey(end);
  const endDate = new Date(`${endKey}T00:00:00`);
  if (allDay) endDate.setDate(endDate.getDate() - 1);

  if (endDate <= startDate) return [startKey];

  const keys: string[] = [];
  for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    keys.push(toDateKey(d));
  }
  return keys;
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

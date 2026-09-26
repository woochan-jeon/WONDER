// Shared (client + server) definitions for the # 타임스탬프 channel.

/** One tab per project in the timestamp Google Sheet, in display order. */
export const TIMESTAMP_TABS = ["팀전", "제니홍", "페네핏"] as const;
export type TimestampTab = (typeof TIMESTAMP_TABS)[number];

export function isTimestampTab(value: unknown): value is TimestampTab {
  return typeof value === "string" && (TIMESTAMP_TABS as readonly string[]).includes(value);
}

export type TimestampEntry = {
  /** 1-indexed sheet row, used to address the row for edits/deletes. */
  row: number;
  /** YYYY-MM-DD, or the raw cell text when it couldn't be parsed as a date. */
  date: string;
  /** False when `date` is the raw, unparseable cell text. */
  dateValid: boolean;
  content: string;
  note: string;
};

/**
 * Accepts the date shapes people actually type into the sheet —
 * "2026-02-10", "2026.02.10", "2026/2/10", Sheets' Korean-locale "2026. 2. 10" —
 * and returns YYYY-MM-DD, or null if it isn't a real calendar date.
 */
export function normalizeDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    return null;
  }
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

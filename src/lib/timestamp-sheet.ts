import "server-only";
import { google, sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "@/lib/google-calendar";
import { SheetsScopeError } from "@/lib/google-sheets";
import { normalizeDate, type TimestampEntry, type TimestampTab } from "@/lib/timestamp";

/**
 * The "WONDER 타임스탬프" spreadsheet in the connected team Google account
 * (hufs.wonder@gmail.com), created by scripts/create-timestamp-sheet.mjs.
 * The sheet itself is the source of truth — this channel reads and writes it
 * directly, with no DB copy. Override with TIMESTAMP_SHEET_ID to point the
 * channel at a different sheet (it must have the tabs in TIMESTAMP_TABS).
 */
const DEFAULT_SHEET_ID = "1d-ji-0fUKZOBYWpwjmcalNFdQywx8c8hsIqzFpTjtTw";

// Columns: A = 날짜(YYYY-MM-DD), B = 내용, C = 비고. Row 1 is the header.
const HEADER = ["날짜(YYYY-MM-DD)", "내용", "비고"];

export function timestampSheetId() {
  return process.env.TIMESTAMP_SHEET_ID || DEFAULT_SHEET_ID;
}

export function timestampSheetUrl(tabGid?: number | null) {
  const base = `https://docs.google.com/spreadsheets/d/${timestampSheetId()}/edit`;
  return tabGid != null ? `${base}#gid=${tabGid}` : base;
}

/** Thrown when the sheet (or one of its tabs) no longer exists or isn't shared with the connected account. */
export class TimestampSheetMissingError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "TimestampSheetMissingError";
  }
}

function errorCode(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err ? (err as { code: unknown }).code : undefined;
}

// Maps Google API errors onto the errors the page knows how to explain.
function translateError(err: unknown): never {
  const code = errorCode(err);
  if (code === 403) throw new SheetsScopeError();
  if (code === 404) throw new TimestampSheetMissingError("타임스탬프 구글 시트를 찾을 수 없습니다");
  if (code === 400 && String((err as Error).message ?? "").includes("Unable to parse range")) {
    throw new TimestampSheetMissingError("타임스탬프 구글 시트에 해당 탭이 없습니다");
  }
  throw err;
}

async function getSheets(): Promise<sheets_v4.Sheets | null> {
  const authorized = await getAuthorizedClient();
  if (!authorized) return null;
  return google.sheets({ version: "v4", auth: authorized.client });
}

async function requireSheets() {
  const sheets = await getSheets();
  if (!sheets) throw new Error("구글 계정이 연결되어 있지 않습니다");
  return sheets;
}

function cell(row: string[] | undefined, index: number) {
  return String(row?.[index] ?? "").trim();
}

function toEntries(values: string[][]): TimestampEntry[] {
  const entries: TimestampEntry[] = [];
  values.forEach((row, i) => {
    const rawDate = cell(row, 0);
    const content = cell(row, 1);
    const note = cell(row, 2);
    if (!rawDate && !content && !note) return; // blank spacer row
    const date = normalizeDate(rawDate);
    entries.push({ row: i + 2, date: date ?? rawDate, dateValid: date !== null, content, note });
  });
  return entries;
}

async function tabGids(sheets: sheets_v4.Sheets): Promise<Map<string, number>> {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: timestampSheetId(),
    fields: "sheets.properties(sheetId,title)",
  });
  return new Map(
    (data.sheets ?? []).map((s) => [s.properties?.title ?? "", s.properties?.sheetId ?? 0] as [string, number]),
  );
}

async function requireTabGid(sheets: sheets_v4.Sheets, tab: TimestampTab) {
  const gid = (await tabGids(sheets)).get(tab);
  if (gid == null) throw new TimestampSheetMissingError(`타임스탬프 구글 시트에 "${tab}" 탭이 없습니다`);
  return gid;
}

export type TimestampTabData = { entries: TimestampEntry[]; gid: number | null };

/** Every row of one tab, or null if no Google account is connected. */
export async function readTimestampTab(tab: TimestampTab): Promise<TimestampTabData | null> {
  const sheets = await getSheets();
  if (!sheets) return null;
  try {
    const [gids, { data }] = await Promise.all([
      tabGids(sheets),
      sheets.spreadsheets.values.get({ spreadsheetId: timestampSheetId(), range: `'${tab}'!A2:C` }),
    ]);
    if (!gids.has(tab)) throw new TimestampSheetMissingError(`타임스탬프 구글 시트에 "${tab}" 탭이 없습니다`);
    return { entries: toEntries((data.values ?? []) as string[][]), gid: gids.get(tab) ?? null };
  } catch (err) {
    if (err instanceof TimestampSheetMissingError) throw err;
    translateError(err);
  }
}

// Keeps each tab in chronological order after a write. Dates are stored as
// YYYY-MM-DD text, so a plain A→Z sort on column A is chronological.
async function sortTab(sheets: sheets_v4.Sheets, gid: number) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: timestampSheetId(),
    requestBody: {
      requests: [
        {
          sortRange: {
            range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADER.length },
            sortSpecs: [{ dimensionIndex: 0, sortOrder: "ASCENDING" }],
          },
        },
      ],
    },
  });
}

export type TimestampInput = { date: string; content: string; note: string };

export async function appendTimestampEntry(tab: TimestampTab, input: TimestampInput) {
  const sheets = await requireSheets();
  try {
    const gid = await requireTabGid(sheets, tab);
    await sheets.spreadsheets.values.append({
      spreadsheetId: timestampSheetId(),
      range: `'${tab}'!A:C`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[input.date, input.content, input.note]] },
    });
    await sortTab(sheets, gid);
  } catch (err) {
    if (err instanceof TimestampSheetMissingError) throw err;
    translateError(err);
  }
}

/**
 * Row numbers shift when someone edits the sheet directly, so every
 * row-addressed write first re-reads the row and checks it still holds the
 * entry the user was looking at.
 */
async function assertRowUnchanged(
  sheets: sheets_v4.Sheets,
  tab: TimestampTab,
  row: number,
  expected: { date: string; content: string },
) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: timestampSheetId(),
    range: `'${tab}'!A${row}:C${row}`,
  });
  const current = (data.values?.[0] ?? []) as string[];
  const currentDate = normalizeDate(cell(current, 0)) ?? cell(current, 0);
  if (currentDate !== expected.date || cell(current, 1) !== expected.content) {
    throw new TimestampSheetMissingError("시트 내용이 바뀌었습니다. 새로고침 후 다시 시도해 주세요");
  }
}

export async function updateTimestampEntry(
  tab: TimestampTab,
  row: number,
  expected: { date: string; content: string },
  input: TimestampInput,
) {
  const sheets = await requireSheets();
  try {
    const gid = await requireTabGid(sheets, tab);
    await assertRowUnchanged(sheets, tab, row, expected);
    await sheets.spreadsheets.values.update({
      spreadsheetId: timestampSheetId(),
      range: `'${tab}'!A${row}:C${row}`,
      valueInputOption: "RAW",
      requestBody: { values: [[input.date, input.content, input.note]] },
    });
    await sortTab(sheets, gid);
  } catch (err) {
    if (err instanceof TimestampSheetMissingError) throw err;
    translateError(err);
  }
}

export async function deleteTimestampEntry(
  tab: TimestampTab,
  row: number,
  expected: { date: string; content: string },
) {
  const sheets = await requireSheets();
  try {
    const gid = await requireTabGid(sheets, tab);
    await assertRowUnchanged(sheets, tab, row, expected);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: timestampSheetId(),
      requestBody: {
        requests: [
          { deleteDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: row - 1, endIndex: row } } },
        ],
      },
    });
  } catch (err) {
    if (err instanceof TimestampSheetMissingError) throw err;
    translateError(err);
  }
}

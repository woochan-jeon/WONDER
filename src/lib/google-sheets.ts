import "server-only";
import { google } from "googleapis";
import { getAuthorizedClient } from "@/lib/google-calendar";

const SHEET_TAB = "회계장부";
const DATA_RANGE = `${SHEET_TAB}!A2:J`;
const BALANCE_RANGE = `${SHEET_TAB}!H2:H`;

/**
 * Thrown when the connected Google account's token doesn't have Sheets access
 * yet — e.g. it was connected before the `spreadsheets` scope was added.
 * The admin needs to reconnect (disconnect + connect again) to re-consent.
 */
export class SheetsScopeError extends Error {
  constructor() {
    super("The connected Google account has not granted Sheets access.");
    this.name = "SheetsScopeError";
  }
}

function isInsufficientScope(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 403;
}

function getSheetsClient(client: Awaited<ReturnType<typeof getAuthorizedClient>>) {
  if (!client) return null;
  return google.sheets({ version: "v4", auth: client.client });
}

export type LedgerProject = {
  id: string;
  label: string;
  sheetId: string;
};

export const LEDGER_PROJECTS: LedgerProject[] = [
  {
    id: "team-exhibition",
    label: "팀전시회",
    sheetId: "1jNS3Ol2TUykXGbBGdCsTaCKZJsSyDLi-7YrAJ3rE6yI", // 00. 회계장부(팀전시회)
  },
  {
    id: "team-exhibition-internal",
    label: "팀전시회(내부용)",
    sheetId: "1ywYzDG6kCzsD4W9nCg1yEIrijqOtnG9ERT-5qaVnAnc", // 00. 내부용 회계장부(팀전시회)
  },
  {
    id: "startup-club",
    label: "창업동아리",
    sheetId: "1jXT2NW4LDXtnDg2HR_AzmJzNw_WAy2UBFRIxRWtiluQ", // 02. 회계장부(창업동아리)
  },
];

export function ledgerSheetUrl(project: LedgerProject) {
  return `https://docs.google.com/spreadsheets/d/${project.sheetId}/edit`;
}

export type LedgerEntry = {
  // 1-indexed row number in the sheet (data starts at row 2) — identifies
  // which row an edit should target.
  row: number;
  date: string;
  time: string;
  content: string;
  name: string;
  method: string;
  income: number | null;
  expense: number | null;
  balance: number | null;
  note: string;
  receipt: string;
};

function parseAmount(v: string | undefined | null): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && v.trim() !== "" ? n : null;
}

function toEntry(row: string[], sheetRow: number): LedgerEntry {
  return {
    row: sheetRow,
    date: row[0] ?? "",
    time: row[1] ?? "",
    content: row[2] ?? "",
    name: row[3] ?? "",
    method: row[4] ?? "",
    income: parseAmount(row[5]),
    expense: parseAmount(row[6]),
    balance: parseAmount(row[7]),
    note: row[8] ?? "",
    receipt: row[9] ?? "",
  };
}

/** Ledger rows for a project's primary sheet, newest first. */
export async function listLedgerEntries(project: LedgerProject): Promise<LedgerEntry[]> {
  const authorized = await getAuthorizedClient();
  const sheets = getSheetsClient(authorized);
  if (!sheets) return [];

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: project.sheetId,
      range: DATA_RANGE,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (data.values as string[][] | undefined) ?? [];
    return rows.map((r, i) => toEntry(r, i + 2)).reverse();
  } catch (err) {
    if (isInsufficientScope(err)) throw new SheetsScopeError();
    throw err;
  }
}

export type NewLedgerEntryInput = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  content: string;
  name: string;
  method: string;
  type: "income" | "expense";
  amount: number;
  note: string;
  receipt: string;
};

/**
 * Appends a new row to the project's sheet, computing the running balance
 * (수입 - 지출 running total, stored as a literal number in the existing
 * sheets rather than a formula) from its last row.
 */
export async function appendLedgerEntry(project: LedgerProject, input: NewLedgerEntryInput) {
  const authorized = await getAuthorizedClient();
  const sheets = getSheetsClient(authorized);
  if (!sheets) throw new Error("연결된 구글 계정이 없습니다");

  const delta = input.type === "income" ? input.amount : -input.amount;

  try {
    const { data: balanceData } = await sheets.spreadsheets.values.get({
      spreadsheetId: project.sheetId,
      range: BALANCE_RANGE,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const balanceRows = (balanceData.values as string[][] | undefined) ?? [];
    const lastBalance = parseAmount(balanceRows.at(-1)?.[0]) ?? 0;
    const newBalance = lastBalance + delta;

    await sheets.spreadsheets.values.append({
      spreadsheetId: project.sheetId,
      range: DATA_RANGE,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            input.date,
            input.time,
            input.content,
            input.name,
            input.method,
            input.type === "income" ? input.amount : "",
            input.type === "expense" ? input.amount : "",
            newBalance,
            input.note,
            input.receipt,
          ],
        ],
      },
    });
  } catch (err) {
    if (isInsufficientScope(err)) throw new SheetsScopeError();
    throw err;
  }
}

/**
 * Overwrites an existing row in place. Because the sheet stores the running
 * balance as a literal number rather than a formula, changing a row's amount
 * shifts every balance after it — so this re-derives the balance for the
 * edited row and cascades the new balance down through the rest of the
 * sheet (the other columns of later rows are untouched).
 */
export async function updateLedgerEntry(project: LedgerProject, row: number, input: NewLedgerEntryInput) {
  const authorized = await getAuthorizedClient();
  const sheets = getSheetsClient(authorized);
  if (!sheets) throw new Error("연결된 구글 계정이 없습니다");

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: project.sheetId,
      range: DATA_RANGE,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = (data.values as string[][] | undefined) ?? [];
    const targetIndex = row - 2;
    if (targetIndex < 0 || targetIndex >= rows.length) throw new Error("해당 항목을 찾을 수 없습니다");

    const prevBalance = targetIndex > 0 ? (parseAmount(rows[targetIndex - 1]?.[7]) ?? 0) : 0;
    const delta = input.type === "income" ? input.amount : -input.amount;
    const newBalance = prevBalance + delta;

    await sheets.spreadsheets.values.update({
      spreadsheetId: project.sheetId,
      range: `${SHEET_TAB}!A${row}:J${row}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            input.date,
            input.time,
            input.content,
            input.name,
            input.method,
            input.type === "income" ? input.amount : "",
            input.type === "expense" ? input.amount : "",
            newBalance,
            input.note,
            input.receipt,
          ],
        ],
      },
    });

    if (targetIndex + 1 < rows.length) {
      let runningBalance = newBalance;
      const cascadeBalances: number[] = [];
      for (let i = targetIndex + 1; i < rows.length; i++) {
        const rowDelta = (parseAmount(rows[i]?.[5]) ?? 0) - (parseAmount(rows[i]?.[6]) ?? 0);
        runningBalance += rowDelta;
        cascadeBalances.push(runningBalance);
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: project.sheetId,
        range: `${SHEET_TAB}!H${row + 1}:H${row + cascadeBalances.length}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: cascadeBalances.map((b) => [b]) },
      });
    }
  } catch (err) {
    if (isInsufficientScope(err)) throw new SheetsScopeError();
    throw err;
  }
}

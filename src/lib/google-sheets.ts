import "server-only";
import { google, sheets_v4 } from "googleapis";
import { getAuthorizedClient } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/calendar-grid";
import { isCurrencyCode } from "@/lib/currency";
import type { MarketingCategory, MarketingExpense, MarketingProject } from "@/generated/prisma/client";

/**
 * Thrown when the connected Google account's token doesn't have Sheets access
 * yet (added after the account was first connected) — same shape as
 * DriveScopeError in google-drive.ts. The admin needs to reconnect to
 * re-consent to the new scope.
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

function isNotFound(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 404;
}

const SPREADSHEET_TITLE = "WONDER 마케팅 채널";

// [tab name, header row]. Column A is always the record ID — used to match
// sheet rows back to database records. Rows typed in without an ID are
// treated as new records; rows with an ID that no longer exists in the sheet
// are simply re-added on the next sync rather than deleted (see syncMarketingSheet).
const PROJECTS_TAB = "프로젝트";
const PROJECTS_HEADER = ["ID (수정 금지)", "이름", "색상(#RRGGBB)", "통화(KRW/JPY/SGD)"];
const CATEGORIES_TAB = "카테고리";
const CATEGORIES_HEADER = ["ID (수정 금지)", "프로젝트", "이름", "색상(#RRGGBB)"];
const BUDGETS_TAB = "예산";
const BUDGETS_HEADER = ["ID (수정 금지)", "프로젝트", "카테고리", "연도", "월", "금액"];
const EXPENSES_TAB = "지출내역";
const EXPENSES_HEADER = [
  "ID (수정 금지)",
  "날짜(YYYY-MM-DD)",
  "프로젝트",
  "카테고리",
  "채널",
  "설명",
  "금액",
  "결제수단",
  "메모",
];

const TABS = [
  { name: PROJECTS_TAB, header: PROJECTS_HEADER },
  { name: CATEGORIES_TAB, header: CATEGORIES_HEADER },
  { name: BUDGETS_TAB, header: BUDGETS_HEADER },
  { name: EXPENSES_TAB, header: EXPENSES_HEADER },
] as const;

function getSheetsClient(authorized: NonNullable<Awaited<ReturnType<typeof getAuthorizedClient>>>) {
  return google.sheets({ version: "v4", auth: authorized.client });
}

function colLetter(oneIndexed: number) {
  return String.fromCharCode("A".charCodeAt(0) + oneIndexed - 1);
}

function dataRange(tab: string, header: readonly string[]) {
  return `'${tab}'!A2:${colLetter(header.length)}`;
}

async function createMarketingSpreadsheet(sheets: sheets_v4.Sheets): Promise<string> {
  const { data } = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SPREADSHEET_TITLE },
      sheets: TABS.map((tab) => ({ properties: { title: tab.name } })),
    },
  });
  const spreadsheetId = data.spreadsheetId;
  if (!spreadsheetId) throw new Error("구글 시트 생성에 실패했습니다");

  // Write headers and format every data cell as plain text so hand-typed
  // dates/numbers/IDs round-trip exactly as typed instead of Sheets silently
  // converting them to serial dates or locale-formatted numbers.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: (data.sheets ?? []).map((sheet) => ({
        repeatCell: {
          range: { sheetId: sheet.properties?.sheetId, startRowIndex: 0, endRowIndex: 5000 },
          cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      })),
    },
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: TABS.map((tab) => ({ range: `'${tab.name}'!A1`, values: [[...tab.header]] })),
    },
  });

  return spreadsheetId;
}

async function ensureSpreadsheetId(
  authorized: NonNullable<Awaited<ReturnType<typeof getAuthorizedClient>>>,
  sheets: sheets_v4.Sheets,
): Promise<string> {
  const connection = await prisma.calendarConnection.findFirst();
  if (connection?.marketingSheetId) return connection.marketingSheetId;

  const spreadsheetId = await createMarketingSpreadsheet(sheets);
  await prisma.calendarConnection.updateMany({ data: { marketingSheetId: spreadsheetId } });
  return spreadsheetId;
}

export function marketingSheetUrl(spreadsheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

/** Row id/URL of the connected team's marketing sheet, without talking to Google — for rendering the "open in sheets" link. */
export async function getMarketingSheetUrl(): Promise<string | null> {
  const connection = await prisma.calendarConnection.findFirst();
  return connection?.marketingSheetId ? marketingSheetUrl(connection.marketingSheetId) : null;
}

function normalizeColor(value: string | undefined, fallback: string) {
  const trimmed = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function cell(row: string[], index: number) {
  return (row[index] ?? "").trim();
}

// Amounts are in each project's own currency and may carry cents (SGD), so
// keep the decimal point; everything else (commas, currency symbols) is dropped.
function parseAmount(value: string) {
  return Number.parseFloat(value.replace(/[^\d.-]/g, ""));
}

async function reconcileProjects(rows: string[][]) {
  const existing = await prisma.marketingProject.findMany();
  const byId = new Map(existing.map((p) => [p.id, p]));

  for (const row of rows) {
    const id = cell(row, 0);
    const name = cell(row, 1);
    if (!name) continue;
    const color = normalizeColor(row[2], "#0066cc");
    const currencyCell = cell(row, 3).toUpperCase();

    if (id && byId.has(id)) {
      const current = byId.get(id)!;
      // A blank/unknown currency cell (e.g. a sheet written before the column
      // existed) keeps the project's current currency.
      const currency = isCurrencyCode(currencyCell) ? currencyCell : current.currency;
      if (current.name !== name || current.color !== color || current.currency !== currency) {
        await prisma.marketingProject.update({ where: { id }, data: { name, color, currency } }).catch(() => {});
      }
    } else if (!id && !existing.some((p) => p.name === name)) {
      const currency = isCurrencyCode(currencyCell) ? currencyCell : "KRW";
      await prisma.marketingProject.create({ data: { name, color, currency } }).catch(() => {});
    }
  }
}

async function reconcileCategories(rows: string[][]) {
  const projects = await prisma.marketingProject.findMany();
  const projectByName = new Map(projects.map((p) => [p.name, p]));
  const existing = await prisma.marketingCategory.findMany();
  const byId = new Map(existing.map((c) => [c.id, c]));

  for (const row of rows) {
    const id = cell(row, 0);
    const project = projectByName.get(cell(row, 1));
    const name = cell(row, 2);
    if (!project || !name) continue;
    const color = normalizeColor(row[3], "#0066cc");

    if (id && byId.has(id)) {
      const current = byId.get(id)!;
      if (current.name !== name || current.color !== color || current.projectId !== project.id) {
        await prisma.marketingCategory
          .update({ where: { id }, data: { name, color, projectId: project.id } })
          .catch(() => {});
      }
    } else if (!id && !existing.some((c) => c.projectId === project.id && c.name === name)) {
      await prisma.marketingCategory.create({ data: { projectId: project.id, name, color } }).catch(() => {});
    }
  }
}

async function reconcileBudgets(rows: string[][]) {
  const projects = await prisma.marketingProject.findMany({ include: { categories: true } });
  const projectByName = new Map(projects.map((p) => [p.name, p]));
  const existing = await prisma.marketingBudget.findMany();

  for (const row of rows) {
    const project = projectByName.get(cell(row, 1));
    const categoryName = cell(row, 2);
    const category = categoryName ? project?.categories.find((c) => c.name === categoryName) : undefined;
    const categoryId = category?.id ?? null;
    const year = Number.parseInt(cell(row, 3), 10);
    const month = Number.parseInt(cell(row, 4), 10);
    const amount = parseAmount(cell(row, 5));
    if (!project || !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(amount)) continue;
    if (categoryName && !category) continue;
    if (month < 1 || month > 12) continue;

    const current = existing.find(
      (b) => b.projectId === project.id && b.categoryId === categoryId && b.year === year && b.month === month,
    );
    if (current?.amount === amount) continue;

    if (current) {
      await prisma.marketingBudget.update({ where: { id: current.id }, data: { amount } }).catch(() => {});
    } else {
      await prisma.marketingBudget
        .create({ data: { projectId: project.id, categoryId, year, month, amount } })
        .catch(() => {});
    }
  }
}

async function reconcileExpenses(rows: string[][]) {
  const projects = await prisma.marketingProject.findMany({ include: { categories: true } });
  const projectByName = new Map(projects.map((p) => [p.name, p]));
  const existing = await prisma.marketingExpense.findMany();
  const byId = new Map(existing.map((e) => [e.id, e]));

  for (const row of rows) {
    const id = cell(row, 0);
    const dateStr = cell(row, 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    const project = projectByName.get(cell(row, 2));
    if (!project) continue;
    const categoryName = cell(row, 3);
    const category = categoryName ? project.categories.find((c) => c.name === categoryName) : undefined;
    const channel = cell(row, 4);
    const description = cell(row, 5);
    const amount = parseAmount(cell(row, 6));
    const paymentMethod = cell(row, 7);
    const note = cell(row, 8);
    if (!channel || !description || !Number.isFinite(amount) || !paymentMethod) continue;

    const data = {
      date: new Date(`${dateStr}T00:00:00`),
      projectId: project.id,
      categoryId: category?.id ?? null,
      channel,
      description,
      amount,
      paymentMethod,
      note: note || null,
    };

    if (id && byId.has(id)) {
      const current = byId.get(id)!;
      const changed =
        toDateKey(current.date) !== dateStr ||
        current.projectId !== data.projectId ||
        current.categoryId !== data.categoryId ||
        current.channel !== data.channel ||
        current.description !== data.description ||
        current.amount !== data.amount ||
        current.paymentMethod !== data.paymentMethod ||
        (current.note ?? "") !== (data.note ?? "");
      if (changed) {
        await prisma.marketingExpense.update({ where: { id }, data }).catch(() => {});
      }
    } else if (!id) {
      await prisma.marketingExpense.create({ data }).catch(() => {});
    }
  }
}

function projectRows(projects: MarketingProject[]): string[][] {
  return projects.map((p) => [p.id, p.name, p.color, p.currency]);
}

function categoryRows(categories: (MarketingCategory & { project: MarketingProject })[]): string[][] {
  return categories.map((c) => [c.id, c.project.name, c.name, c.color]);
}

function budgetRows(
  budgets: {
    id: string;
    year: number;
    month: number;
    amount: number;
    project: MarketingProject;
    category: MarketingCategory | null;
  }[],
): string[][] {
  return budgets.map((b) => [
    b.id,
    b.project.name,
    b.category?.name ?? "",
    String(b.year),
    String(b.month),
    String(b.amount),
  ]);
}

function expenseRows(
  expenses: (MarketingExpense & { project: MarketingProject; category: MarketingCategory | null })[],
): string[][] {
  return expenses.map((e) => [
    e.id,
    toDateKey(e.date),
    e.project.name,
    e.category?.name ?? "",
    e.channel,
    e.description,
    String(e.amount),
    e.paymentMethod,
    e.note ?? "",
  ]);
}

// Sheets created before a column was added keep their old header row;
// rewrite any header that no longer matches so new columns get labeled.
async function ensureHeaders(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: TABS.map((tab) => `'${tab.name}'!A1:${colLetter(tab.header.length)}1`),
  });
  const stale = TABS.filter(
    (tab, i) => !sameRows((data.valueRanges?.[i]?.values ?? []) as string[][], [[...tab.header]]),
  );
  if (stale.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: stale.map((tab) => ({ range: `'${tab.name}'!A1`, values: [[...tab.header]] })),
    },
  });
}

function sameRows(a: string[][], b: string[][]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Two-way sync between the marketing DB tables and the team's marketing
 * Google Sheet:
 *  1. Reads every tab and applies any hand-typed additions/edits into the DB
 *     (rows with a blank ID are new records; rows with a known ID update it).
 *  2. Rewrites every tab from the now-current DB state.
 *
 * Deleting a row in the sheet does NOT delete the underlying record — it
 * simply reappears on the next sync, since step 2 always mirrors the DB.
 * Records are only deleted through the app's own delete buttons. This keeps
 * the sync safe from an accidental blank/cleared row cascading into data
 * loss, while still letting the sheet be edited freely for additions/edits.
 *
 * Returns the sheet's URL, or null if no Google account is connected.
 * Throws SheetsScopeError if the connected account hasn't granted Sheets access.
 */
export async function syncMarketingSheet(): Promise<string | null> {
  const authorized = await getAuthorizedClient();
  if (!authorized) return null;

  const sheets = getSheetsClient(authorized);

  let spreadsheetId: string;
  try {
    spreadsheetId = await ensureSpreadsheetId(authorized, sheets);
  } catch (err) {
    if (isInsufficientScope(err)) throw new SheetsScopeError();
    throw err;
  }

  let current: sheets_v4.Schema$ValueRange[];
  try {
    const { data } = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: TABS.map((tab) => dataRange(tab.name, tab.header)),
    });
    current = data.valueRanges ?? [];
  } catch (err) {
    if (isInsufficientScope(err)) throw new SheetsScopeError();
    if (isNotFound(err)) {
      // The sheet was deleted out from under us — forget it and recreate on next sync.
      await prisma.calendarConnection.updateMany({ data: { marketingSheetId: null } });
      return null;
    }
    throw err;
  }

  const [projectRowsIn, categoryRowsIn, budgetRowsIn, expenseRowsIn] = current.map(
    (range) => (range.values ?? []) as string[][],
  );

  await ensureHeaders(sheets, spreadsheetId);
  await reconcileProjects(projectRowsIn ?? []);
  await reconcileCategories(categoryRowsIn ?? []);
  await reconcileBudgets(budgetRowsIn ?? []);
  await reconcileExpenses(expenseRowsIn ?? []);

  const [projects, categories, budgets, expenses] = await Promise.all([
    prisma.marketingProject.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.marketingCategory.findMany({ include: { project: true }, orderBy: { createdAt: "asc" } }),
    prisma.marketingBudget.findMany({ include: { project: true, category: true }, orderBy: { createdAt: "asc" } }),
    prisma.marketingExpense.findMany({ include: { project: true, category: true }, orderBy: { date: "asc" } }),
  ]);

  const desired = [
    projectRows(projects),
    categoryRows(categories),
    budgetRows(budgets),
    expenseRows(expenses),
  ];
  const before = [projectRowsIn ?? [], categoryRowsIn ?? [], budgetRowsIn ?? [], expenseRowsIn ?? []];

  const dirtyIndexes = TABS.map((_, i) => i).filter((i) => !sameRows(before[i], desired[i]));
  if (dirtyIndexes.length > 0) {
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: { ranges: dirtyIndexes.map((i) => dataRange(TABS[i].name, TABS[i].header)) },
    });
    const nonEmpty = dirtyIndexes.filter((i) => desired[i].length > 0);
    if (nonEmpty.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: nonEmpty.map((i) => ({ range: `'${TABS[i].name}'!A2`, values: desired[i] })),
        },
      });
    }
  }

  return marketingSheetUrl(spreadsheetId);
}

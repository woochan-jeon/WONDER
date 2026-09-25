"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { syncMarketingSheet } from "@/lib/google-sheets";
import { CURRENCIES, CURRENCY_CODES, FOREIGN_CURRENCIES, toCurrencyCode } from "@/lib/currency";

export type ActionState = { error?: string };

// Best-effort push to the team's marketing Google Sheet after a DB change.
// Never lets a sheet sync problem (not connected, missing scope, API hiccup)
// fail the actual mutation the user just made.
async function syncMarketingSheetQuietly() {
  await syncMarketingSheet().catch((err) => {
    console.error("Marketing sheet sync failed:", err);
  });
}

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "프로젝트 이름을 입력해 주세요").max(30),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "올바른 색상 값이 아닙니다"),
  currency: z.enum(CURRENCY_CODES, { message: "통화를 선택해 주세요" }),
});

// Rounds an amount to what its project's currency can express (whole 원/엔,
// 싱가포르 달러 to the cent), so float noise from the form never gets stored.
async function roundForProject(projectId: string, amount: number) {
  const project = await prisma.marketingProject.findUnique({ where: { id: projectId }, select: { currency: true } });
  const factor = 10 ** CURRENCIES[toCurrencyCode(project?.currency ?? "KRW")].decimals;
  return Math.round(amount * factor) / factor;
}

export async function createProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    currency: formData.get("currency") || "KRW",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { name, color, currency } = parsed.data;

  const existing = await prisma.marketingProject.findUnique({ where: { name } });
  if (existing) return { error: "이미 있는 프로젝트 이름입니다" };

  await prisma.marketingProject.create({ data: { name, color, currency } });
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
  return {};
}

// Changes only the unit — existing amounts keep their numbers, so this is
// for fixing a project's currency, not converting its history.
export async function updateProjectCurrencyAction(projectId: string, currency: string) {
  const parsed = z.enum(CURRENCY_CODES).safeParse(currency);
  if (!parsed.success) return;
  await prisma.marketingProject.updateMany({ where: { id: projectId }, data: { currency: parsed.data } });
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
}

const exchangeRateSchema = z.object({
  currency: z.enum(FOREIGN_CURRENCIES as [string, ...string[]]),
  rate: z.coerce.number({ message: "환율을 입력해 주세요" }).positive("0보다 큰 환율을 입력해 주세요").max(100000),
});

export async function setExchangeRateAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = exchangeRateSchema.safeParse({ currency: formData.get("currency"), rate: formData.get("rate") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { currency, rate } = parsed.data;
  await prisma.marketingExchangeRate.upsert({ where: { currency }, create: { currency, rate }, update: { rate } });
  revalidatePath("/marketing");
  return {};
}

/** Drops a manual override so the currency goes back to the live default rate. */
export async function resetExchangeRateAction(currency: string) {
  await prisma.marketingExchangeRate.deleteMany({ where: { currency } });
  revalidatePath("/marketing");
}

export async function deleteProjectAction(projectId: string) {
  await prisma.marketingProject.delete({ where: { id: projectId } });
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
}

const createCategorySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "카테고리 이름을 입력해 주세요").max(30),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "올바른 색상 값이 아닙니다"),
});

export async function createCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createCategorySchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { projectId, name, color } = parsed.data;

  const existing = await prisma.marketingCategory.findUnique({
    where: { projectId_name: { projectId, name } },
  });
  if (existing) return { error: "이미 있는 카테고리 이름입니다" };

  await prisma.marketingCategory.create({ data: { projectId, name, color } });
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
  return {};
}

export async function deleteCategoryAction(categoryId: string) {
  await prisma.marketingCategory.delete({ where: { id: categoryId } });
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
}

const setBudgetSchema = z.object({
  projectId: z.string().min(1),
  categoryId: z.string().trim().optional(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0, "0 이상의 금액을 입력해 주세요"),
});

export async function setBudgetAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setBudgetSchema.safeParse({
    projectId: formData.get("projectId"),
    categoryId: formData.get("categoryId") || undefined,
    year: formData.get("year"),
    month: formData.get("month"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { projectId, categoryId, year, month } = parsed.data;
  const category = categoryId || null;
  const amount = await roundForProject(projectId, parsed.data.amount);

  // Prisma's compound-unique lookup can't take null for a nullable field, so
  // upsert on (projectId, categoryId, year, month) manually.
  const existing = await prisma.marketingBudget.findFirst({
    where: { projectId, categoryId: category, year, month },
  });
  if (existing) {
    await prisma.marketingBudget.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.marketingBudget.create({ data: { projectId, categoryId: category, year, month, amount } });
  }
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
  return {};
}

const expenseSchema = z.object({
  projectId: z.string().min(1, "프로젝트를 선택해 주세요"),
  categoryId: z.string().trim().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요"),
  channel: z.string().trim().min(1, "채널을 입력해 주세요").max(60),
  description: z.string().trim().min(1, "어떤 마케팅인지 입력해 주세요").max(500),
  amount: z.coerce.number().min(0, "0 이상의 금액을 입력해 주세요"),
  paymentMethod: z.string().trim().min(1, "지출 방식을 입력해 주세요").max(60),
  note: z.string().trim().max(1000).optional(),
});

export async function createExpenseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = expenseSchema.safeParse({
    projectId: formData.get("projectId"),
    categoryId: formData.get("categoryId") || undefined,
    date: formData.get("date"),
    channel: formData.get("channel"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { projectId, categoryId, date, channel, description, paymentMethod, note } = parsed.data;
  const amount = await roundForProject(projectId, parsed.data.amount);

  await prisma.marketingExpense.create({
    data: {
      projectId,
      categoryId: categoryId || null,
      date: new Date(`${date}T00:00:00`),
      channel,
      description,
      amount,
      paymentMethod,
      note: note || null,
    },
  });
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
  return {};
}

const updateExpenseSchema = expenseSchema.extend({ expenseId: z.string().min(1) });

export async function updateExpenseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    projectId: formData.get("projectId"),
    categoryId: formData.get("categoryId") || undefined,
    date: formData.get("date"),
    channel: formData.get("channel"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { expenseId, projectId, categoryId, date, channel, description, paymentMethod, note } = parsed.data;
  const amount = await roundForProject(projectId, parsed.data.amount);

  const result = await prisma.marketingExpense.updateMany({
    where: { id: expenseId },
    data: {
      projectId,
      categoryId: categoryId || null,
      date: new Date(`${date}T00:00:00`),
      channel,
      description,
      amount,
      paymentMethod,
      note: note || null,
    },
  });
  if (result.count === 0) return { error: "지출 항목을 찾을 수 없습니다" };
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
  return {};
}

export async function deleteExpenseAction(expenseId: string) {
  await prisma.marketingExpense.deleteMany({ where: { id: expenseId } });
  await syncMarketingSheetQuietly();
  revalidatePath("/marketing");
}

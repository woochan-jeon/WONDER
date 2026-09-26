"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SheetsScopeError } from "@/lib/google-sheets";
import {
  TimestampSheetMissingError,
  appendTimestampEntry,
  deleteTimestampEntry,
  updateTimestampEntry,
} from "@/lib/timestamp-sheet";
import { TIMESTAMP_TABS, normalizeDate } from "@/lib/timestamp";

export type ActionState = { error?: string };

const entrySchema = z.object({
  tab: z.enum(TIMESTAMP_TABS),
  date: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const date = normalizeDate(value);
      if (!date) ctx.addIssue({ code: "custom", message: "날짜를 입력해 주세요" });
      return date ?? "";
    }),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(200),
  note: z.string().trim().max(500),
});

const rowSchema = z.object({
  row: z.coerce.number().int().min(2),
  expectedDate: z.string(),
  expectedContent: z.string(),
});

// Turns sheet problems into a message for the form instead of an error page.
async function runSheetWrite(write: () => Promise<void>): Promise<ActionState> {
  try {
    await write();
  } catch (err) {
    if (err instanceof TimestampSheetMissingError) return { error: err.message };
    if (err instanceof SheetsScopeError) return { error: "연결된 구글 계정에 시트 접근 권한이 없습니다" };
    console.error("Timestamp sheet write failed:", err);
    return { error: "구글 시트에 저장하지 못했습니다. 잠시 후 다시 시도해 주세요" };
  }
  revalidatePath("/timestamp");
  return {};
}

function parseEntry(formData: FormData) {
  return entrySchema.safeParse({
    tab: formData.get("tab"),
    date: formData.get("date") ?? "",
    content: formData.get("content") ?? "",
    note: formData.get("note") ?? "",
  });
}

export async function createEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseEntry(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { tab, ...input } = parsed.data;
  return runSheetWrite(() => appendTimestampEntry(tab, input));
}

export async function updateEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseEntry(formData);
  const target = rowSchema.safeParse({
    row: formData.get("row"),
    expectedDate: formData.get("expectedDate"),
    expectedContent: formData.get("expectedContent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  if (!target.success) return { error: "수정할 항목을 찾을 수 없습니다" };
  const { tab, ...input } = parsed.data;
  const { row, expectedDate, expectedContent } = target.data;
  return runSheetWrite(() =>
    updateTimestampEntry(tab, row, { date: expectedDate, content: expectedContent }, input),
  );
}

export async function deleteEntryAction(
  tab: string,
  row: number,
  expected: { date: string; content: string },
): Promise<ActionState> {
  const parsedTab = z.enum(TIMESTAMP_TABS).safeParse(tab);
  const parsedRow = z.number().int().min(2).safeParse(row);
  if (!parsedTab.success || !parsedRow.success) return { error: "삭제할 항목을 찾을 수 없습니다" };
  return runSheetWrite(() => deleteTimestampEntry(parsedTab.data, parsedRow.data, expected));
}

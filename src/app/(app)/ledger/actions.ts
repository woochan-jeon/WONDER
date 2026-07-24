"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appendLedgerEntry, LEDGER_PROJECTS } from "@/lib/google-sheets";

export type ActionState = { error?: string };

const addEntrySchema = z.object({
  projectId: z.string().min(1),
  date: z.string().min(1, "날짜를 입력해 주세요"),
  time: z.string().min(1, "시간을 입력해 주세요"),
  content: z.string().trim().min(1, "내용을 입력해 주세요").max(200),
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(50),
  method: z.string().trim().min(1, "결제수단을 입력해 주세요").max(50),
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("금액을 올바르게 입력해 주세요"),
  note: z.string().trim().max(200).optional(),
  receipt: z.string().trim().max(200).optional(),
});

export async function addLedgerEntryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addEntrySchema.safeParse({
    projectId: formData.get("projectId"),
    date: formData.get("date"),
    time: formData.get("time"),
    content: formData.get("content"),
    name: formData.get("name"),
    method: formData.get("method"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
    receipt: formData.get("receipt") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }

  const { projectId, ...input } = parsed.data;
  const project = LEDGER_PROJECTS.find((p) => p.id === projectId);
  if (!project) return { error: "프로젝트를 찾을 수 없습니다" };

  try {
    await appendLedgerEntry(project, { ...input, note: input.note ?? "", receipt: input.receipt ?? "" });
  } catch {
    return { error: "시트에 기록하는 중 오류가 발생했습니다. 연결을 확인해 주세요." };
  }

  revalidatePath("/ledger");
  return {};
}

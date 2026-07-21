"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createEvent, setCalendarIds } from "@/lib/google-calendar";

export type ActionState = { error?: string };

export async function disconnectCalendarAction() {
  await prisma.calendarConnection.deleteMany({});
  revalidatePath("/calendar");
}

export async function selectCalendarsAction(formData: FormData) {
  const calendarIds = formData.getAll("calendarIds").filter((v): v is string => typeof v === "string");
  await setCalendarIds(calendarIds);
  revalidatePath("/calendar");
}

const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "제목을 입력해 주세요").max(200),
    description: z.string().trim().max(2000).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해 주세요"),
    allDay: z.boolean(),
    startTime: z.string().trim().optional(),
    endTime: z.string().trim().optional(),
  })
  .refine((v) => v.allDay || (v.startTime && v.endTime), {
    message: "시작/종료 시간을 입력해 주세요",
    path: ["startTime"],
  })
  .refine((v) => v.allDay || !v.startTime || !v.endTime || v.endTime > v.startTime, {
    message: "종료 시간은 시작 시간보다 늦어야 해요",
    path: ["endTime"],
  });

export async function createEventAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createEventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    date: formData.get("date"),
    allDay: formData.get("allDay") === "on",
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }

  try {
    await createEvent(parsed.data);
  } catch {
    return { error: "일정을 추가하지 못했습니다. 캘린더 연결을 확인해 주세요." };
  }

  revalidatePath("/calendar");
  return {};
}

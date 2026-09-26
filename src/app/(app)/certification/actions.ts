"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CERT_FIELDS, TEAM_FIELDS, getExam, validateLangScore } from "@/lib/minister-cert";

export type ActionState = { error?: string; createdId?: string };

const createMemberSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(30),
});

export async function createMemberAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createMemberSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };

  const existing = await prisma.certMember.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { error: "이미 등록된 이름입니다" };

  const member = await prisma.certMember.create({ data: { name: parsed.data.name } });
  revalidatePath("/certification");
  return { createdId: member.id };
}

export async function deleteMemberAction(memberId: string) {
  await prisma.certMember.deleteMany({ where: { id: memberId } });
  revalidatePath("/certification");
}

const flagsSchema = z
  .object({
    gtepCompleted: z.boolean(),
    gpaOk: z.boolean(),
    gpaSemesterOk: z.boolean(),
    reportSubmitted: z.boolean(),
    ...Object.fromEntries([...CERT_FIELDS, ...TEAM_FIELDS].map((f) => [f, z.boolean()])),
  })
  .partial()
  .strict();

export type MemberFlagsPatch = Partial<
  Record<
    | "gtepCompleted"
    | "gpaOk"
    | "gpaSemesterOk"
    | "reportSubmitted"
    | (typeof CERT_FIELDS)[number]
    | (typeof TEAM_FIELDS)[number],
    boolean
  >
>;

export async function updateMemberFlagsAction(memberId: string, patch: MemberFlagsPatch) {
  const parsed = flagsSchema.safeParse(patch);
  if (!parsed.success) return;
  const data: Record<string, boolean | Date | null> = { ...parsed.data };
  if (parsed.data.gtepCompleted !== undefined) data.gtepCompletedAt = parsed.data.gtepCompleted ? new Date() : null;
  if (parsed.data.gpaOk !== undefined) data.gpaCheckedAt = parsed.data.gpaOk ? new Date() : null;
  if (parsed.data.gpaSemesterOk !== undefined)
    data.gpaSemesterCheckedAt = parsed.data.gpaSemesterOk ? new Date() : null;
  await prisma.certMember.updateMany({ where: { id: memberId }, data });
  revalidatePath("/certification");
}

export async function addLangScoreAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get("memberId") ?? "");
  const exam = String(formData.get("exam") ?? "");
  const gradeRaw = formData.get("grade");
  const scoreRaw = formData.get("score");
  const grade = typeof gradeRaw === "string" && gradeRaw !== "" ? gradeRaw : null;
  const score = typeof scoreRaw === "string" && scoreRaw.trim() !== "" ? Number(scoreRaw) : null;

  const error = validateLangScore({ exam, grade, score });
  if (error) return { error };
  const def = getExam(exam)!;
  const keepsGrade = def.kind === "grade" || def.kind === "pending" || def.kind === "levelScore";
  const keepsScore = def.kind === "direct" || def.kind === "range" || (def.kind === "levelScore" && score !== null);

  const member = await prisma.certMember.findUnique({ where: { id: memberId } });
  if (!member) return { error: "사람을 먼저 선택해 주세요" };

  await prisma.certLangScore.create({
    data: { memberId, exam, grade: keepsGrade ? grade : null, score: keepsScore ? score : null },
  });
  revalidatePath("/certification");
  return {};
}

export async function deleteLangScoreAction(scoreId: string) {
  await prisma.certLangScore.deleteMany({ where: { id: scoreId } });
  revalidatePath("/certification");
}

const exhibitionFieldsSchema = z.object({
  name: z.string().trim().min(1, "전시회명을 입력해 주세요").max(100),
  location: z.enum(["DOMESTIC", "OVERSEAS"], { message: "국내/해외를 선택해 주세요" }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "시작일을 선택해 주세요"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "종료일을 선택해 주세요"),
  hours: z.coerce
    .number({ message: "인정시간을 입력해 주세요" })
    .min(0, "인정시간은 0 이상이어야 합니다")
    .max(1000, "인정시간이 너무 큽니다"),
});

const endAfterStart = (v: { startDate: string; endDate: string }) => v.endDate >= v.startDate;
const endAfterStartMessage = { message: "종료일은 시작일보다 빠를 수 없습니다", path: ["endDate"] };

function readExhibition(formData: FormData) {
  return {
    name: formData.get("name"),
    location: formData.get("location"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    hours: formData.get("hours") === "" ? undefined : formData.get("hours"),
  };
}

export async function createExhibitionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = exhibitionFieldsSchema
    .extend({ memberId: z.string().min(1, "사람을 먼저 선택해 주세요") })
    .refine(endAfterStart, endAfterStartMessage)
    .safeParse({ ...readExhibition(formData), memberId: formData.get("memberId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { memberId, name, location, startDate, endDate, hours } = parsed.data;

  await prisma.certExhibition.create({
    data: {
      memberId,
      name,
      location,
      startDate: new Date(`${startDate}T00:00:00`),
      endDate: new Date(`${endDate}T00:00:00`),
      hours,
    },
  });
  revalidatePath("/certification");
  return {};
}

export async function updateExhibitionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = exhibitionFieldsSchema
    .extend({ exhibitionId: z.string().min(1) })
    .refine(endAfterStart, endAfterStartMessage)
    .safeParse({ ...readExhibition(formData), exhibitionId: formData.get("exhibitionId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  const { exhibitionId, name, location, startDate, endDate, hours } = parsed.data;

  const result = await prisma.certExhibition.updateMany({
    where: { id: exhibitionId },
    data: {
      name,
      location,
      startDate: new Date(`${startDate}T00:00:00`),
      endDate: new Date(`${endDate}T00:00:00`),
      hours,
    },
  });
  if (result.count === 0) return { error: "기록을 찾을 수 없습니다" };
  revalidatePath("/certification");
  return {};
}

export async function deleteExhibitionAction(exhibitionId: string) {
  await prisma.certExhibition.deleteMany({ where: { id: exhibitionId } });
  revalidatePath("/certification");
}

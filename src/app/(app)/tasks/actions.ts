"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/enums";
import { disconnectSlack, sendSlackMessage } from "@/lib/slack";

export type ActionState = { error?: string };

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요").max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeNames: z
    .array(z.string())
    .default([])
    .transform((names) => [...new Set(names.map((n) => n.trim()).filter(Boolean))]),
  categoryId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  slackChannelId: z.string().trim().optional(),
  slackChannelName: z.string().trim().optional(),
});

export async function createTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    assigneeNames: formData.getAll("assigneeNames"),
    categoryId: formData.get("categoryId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    slackChannelId: formData.get("slackChannelId") || undefined,
    slackChannelName: formData.get("slackChannelName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }
  const { title, description, assigneeNames, categoryId, dueDate, slackChannelId, slackChannelName } =
    parsed.data;

  await prisma.task.create({
    data: {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeNames: JSON.stringify(assigneeNames),
      categoryId: categoryId || null,
      slackChannelId: slackChannelId || null,
      slackChannelName: slackChannelName || null,
    },
  });

  revalidatePath("/tasks");
  return {};
}

const editTaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "제목을 입력해 주세요").max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeNames: z
    .array(z.string())
    .default([])
    .transform((names) => [...new Set(names.map((n) => n.trim()).filter(Boolean))]),
  categoryId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  slackChannelId: z.string().trim().optional(),
  slackChannelName: z.string().trim().optional(),
});

export async function updateTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = editTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    assigneeNames: formData.getAll("assigneeNames"),
    categoryId: formData.get("categoryId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    slackChannelId: formData.get("slackChannelId") || undefined,
    slackChannelName: formData.get("slackChannelName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }
  const { taskId, title, description, assigneeNames, categoryId, dueDate, slackChannelId, slackChannelName } =
    parsed.data;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeNames: JSON.stringify(assigneeNames),
      categoryId: categoryId || null,
      slackChannelId: slackChannelId || null,
      slackChannelName: slackChannelName || null,
    },
  });

  revalidatePath("/tasks");
  return {};
}

export async function setTaskStatusAction(taskId: string, status: string) {
  if (!Object.values(TaskStatus).includes(status as TaskStatus)) {
    throw new Error("Invalid status");
  }
  await prisma.task.update({
    where: { id: taskId },
    data: { status: status as TaskStatus },
  });
  revalidatePath("/tasks");
}

export async function deleteTaskAction(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/tasks");
}

const createCategorySchema = z.object({
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
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }
  const { name, color } = parsed.data;

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) {
    return { error: "이미 있는 카테고리 이름입니다" };
  }

  await prisma.category.create({ data: { name, color } });

  revalidatePath("/tasks");
  return {};
}

export async function deleteCategoryAction(categoryId: string) {
  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/tasks");
}

export async function disconnectSlackAction() {
  await disconnectSlack();
  revalidatePath("/tasks");
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
};

export async function sendTaskToSlackAction(taskId: string): Promise<ActionState> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { category: true } });
  if (!task) return { error: "할일을 찾을 수 없습니다" };
  if (!task.slackChannelId) return { error: "슬랙 채널을 먼저 선택해 주세요" };

  const assignees = (JSON.parse(task.assigneeNames) as string[]).join(", ") || "없음";
  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
    : "없음";

  const lines = [
    `*${task.title}*`,
    task.description ? task.description : null,
    `담당자: ${assignees}`,
    `마감일: ${due}`,
    `상태: ${STATUS_LABELS[task.status]}`,
    task.category ? `카테고리: ${task.category.name}` : null,
  ].filter((line): line is string => line !== null);

  try {
    await sendSlackMessage(task.slackChannelId, lines.join("\n"));
  } catch {
    return { error: "슬랙 전송에 실패했습니다. 연결을 확인해 주세요." };
  }

  return {};
}

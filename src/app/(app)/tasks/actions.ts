"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TaskStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string };

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요").max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeIds: z.array(z.string().trim().min(1)).default([]),
  categoryId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
});

export async function createTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    assigneeIds: formData.getAll("assigneeIds"),
    categoryId: formData.get("categoryId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }
  const { title, description, assigneeIds, categoryId, dueDate } = parsed.data;

  await prisma.task.create({
    data: {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignees: { connect: assigneeIds.map((id) => ({ id })) },
      categoryId: categoryId || null,
      createdById: user.id,
    },
  });

  revalidatePath("/tasks");
  return {};
}

const editTaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1, "제목을 입력해 주세요").max(200),
  description: z.string().trim().max(2000).optional(),
  assigneeIds: z.array(z.string().trim().min(1)).default([]),
  categoryId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
});

export async function updateTaskAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const parsed = editTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    assigneeIds: formData.getAll("assigneeIds"),
    categoryId: formData.get("categoryId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }
  const { taskId, title, description, assigneeIds, categoryId, dueDate } = parsed.data;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignees: { set: assigneeIds.map((id) => ({ id })) },
      categoryId: categoryId || null,
    },
  });

  revalidatePath("/tasks");
  return {};
}

export async function setTaskStatusAction(taskId: string, status: string) {
  await requireUser();
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
  await requireUser();
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
  await requireUser();

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
  await requireUser();
  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/tasks");
}

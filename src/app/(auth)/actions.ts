"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/auth";

export type ActionState = { error?: string };

const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요").max(50),
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력해 주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요"),
});

export async function signupAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "이미 가입된 이메일입니다" };
  }

  // The first person to sign up becomes the team admin (can connect the shared Google Calendar).
  const userCount = await prisma.user.count();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: userCount === 0 ? "ADMIN" : "MEMBER",
    },
  });

  await createSession(user.id);
  redirect("/tasks");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일을 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요" };
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다" };
  }

  await createSession(user.id);
  redirect("/tasks");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

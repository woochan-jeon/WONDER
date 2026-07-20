"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type ActionState } from "../actions";

const initialState: ActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">로그인</h2>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          이메일
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          비밀번호
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
          />
        </label>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-[#002D56] px-3 py-2 text-sm font-medium text-white hover:bg-[#00203C] disabled:opacity-60"
        >
          {pending ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-medium text-[#002D56] hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}

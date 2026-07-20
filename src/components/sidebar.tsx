"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";

type SidebarUser = { name: string; email: string; role: string };

const CHANNELS = [
  { href: "/tasks", label: "할일", icon: "✅" },
  { href: "/calendar", label: "캘린더", icon: "📅" },
  { href: "/drive", label: "드라이브", icon: "🗂️" },
  { href: "/minutes", label: "회의록", icon: "📝" },
  { href: "/archive", label: "회의 아카이브", icon: "🗄️" },
];

export default function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-[#002D56] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-sm font-bold">
          W
        </div>
        <div>
          <p className="text-sm font-semibold">WONDER</p>
          <p className="text-xs text-white/50">팀 워크스페이스</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
          채널
        </p>
        <ul className="flex flex-col gap-0.5">
          {CHANNELS.map((c) => {
            const active = pathname?.startsWith(c.href) ?? false;
            return (
              <li key={c.href}>
                <Link
                  href={c.href}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-white/20 font-medium text-white"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  <span aria-hidden>{c.icon}</span>
                  <span># {c.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#8D7150] text-xs font-semibold">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-white/70 hover:bg-white/10"
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const CHANNELS = [
  { href: "/tasks", label: "할일", icon: "✅" },
  { href: "/calendar", label: "캘린더", icon: "📅" },
  { href: "/drive", label: "드라이브", icon: "🗂️" },
  { href: "/minutes", label: "회의록", icon: "📝" },
  { href: "/archive", label: "회의 아카이브", icon: "🗄️" },
  { href: "/ledger", label: "회계장부", icon: "💰" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between bg-[#002D56] px-3 py-3 text-white md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="채널 목록 열기"
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
        >
          ☰
        </button>
        <p className="text-sm font-semibold">WONDER</p>
        <span className="w-8" aria-hidden />
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-[#002D56] text-white transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-sm font-bold">
              W
            </div>
            <div>
              <p className="text-sm font-semibold">WONDER</p>
              <p className="text-xs text-white/50">팀 워크스페이스</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="채널 목록 닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10 md:hidden"
          >
            ✕
          </button>
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
                    onClick={() => setOpen(false)}
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
      </aside>
    </>
  );
}

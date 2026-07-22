"use client";

import Link from "next/link";
import { useState } from "react";

export type ArchiveItem = { agenda: string; decision: string | null };

export type ArchiveMeeting = {
  id: string;
  title: string;
  meetingDate: Date;
  items: ArchiveItem[];
  sourceUrl: string | null;
};

function formatDate(date: Date) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export default function ArchiveBrowser({
  meetings,
  selected,
}: {
  meetings: ArchiveMeeting[];
  selected: ArchiveMeeting | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex h-[75vh] gap-4">
      <button
        onClick={() => setOpen(true)}
        className="absolute left-0 top-0 z-10 flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 hover:bg-gray-50 md:hidden"
      >
        <span aria-hidden>☰</span> 회의 목록
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden
          className="absolute inset-0 z-20 rounded-lg bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`absolute inset-y-0 left-0 z-30 w-72 shrink-0 overflow-y-auto rounded-lg border border-gray-200 bg-white transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 md:hidden">
          <p className="text-xs font-medium text-gray-500">회의 목록</p>
          <button
            onClick={() => setOpen(false)}
            aria-label="회의 목록 닫기"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <ul>
          {meetings.map((m) => {
            const active = selected?.id === m.id;
            return (
              <li key={m.id} className="border-b border-gray-100 last:border-b-0">
                <Link
                  href={`/archive?meeting=${m.id}`}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 text-sm ${
                    active ? "bg-[#002D56]/10 font-medium text-[#002D56]" : "text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <p className="text-xs text-gray-400">{formatDate(m.meetingDate)}</p>
                  <p className="mt-0.5 line-clamp-2">{m.title}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 p-6 pt-12 md:pt-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            왼쪽에서 회의를 선택해 주세요.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs text-gray-400">{formatDate(selected.meetingDate)}</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">{selected.title}</h2>
            </div>

            <ol className="flex flex-col gap-4">
              {selected.items.map((item, i) => (
                <li key={i} className="rounded-lg border border-gray-200 p-3">
                  <p className="flex gap-2 text-sm font-medium text-gray-900">
                    <span className="shrink-0 text-[#002D56]">📋</span>
                    <span>{item.agenda}</span>
                  </p>
                  <p className="mt-1.5 flex gap-2 pl-6 text-sm text-gray-700">
                    <span className="shrink-0 text-[#8D7150]">➜</span>
                    {item.decision ? (
                      <span>{item.decision}</span>
                    ) : (
                      <span className="text-gray-400">별도 결정 없음 (현황 공유)</span>
                    )}
                  </p>
                </li>
              ))}
            </ol>

            {selected.sourceUrl && (
              <a
                href={selected.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start text-xs text-[#002D56] hover:underline"
              >
                원본 회의록 문서 보기 →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

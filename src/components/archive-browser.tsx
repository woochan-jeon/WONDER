import Link from "next/link";

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
  return (
    <div className="flex h-[75vh] gap-4">
      <aside className="w-72 shrink-0 overflow-y-auto rounded-lg border border-gray-200">
        <ul>
          {meetings.map((m) => {
            const active = selected?.id === m.id;
            return (
              <li key={m.id} className="border-b border-gray-100 last:border-b-0">
                <Link
                  href={`/archive?meeting=${m.id}`}
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

      <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 p-6">
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

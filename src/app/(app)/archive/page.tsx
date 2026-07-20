import ChannelHeader from "@/components/channel-header";
import ArchiveBrowser, { type ArchiveItem, type ArchiveMeeting } from "@/components/archive-browser";
import { prisma } from "@/lib/prisma";
import { syncMeetingArchive } from "@/lib/meeting-archive-sync";
import { isSummarizerConfigured } from "@/lib/meeting-summarizer";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ meeting?: string }>;
}) {
  const params = await searchParams;

  const sync = await syncMeetingArchive();

  const rows = await prisma.meetingSummary.findMany({
    orderBy: { meetingDate: "desc" },
  });

  const meetings: ArchiveMeeting[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    meetingDate: r.meetingDate,
    items: JSON.parse(r.itemsJson) as ArchiveItem[],
    sourceUrl: r.sourceUrl,
  }));

  const selected = meetings.find((m) => m.id === params.meeting) ?? meetings[0] ?? null;

  return (
    <>
      <ChannelHeader
        icon="🗄️"
        title="회의 아카이브"
        description="Meet Recordings에 새 회의록이 올라오면 자동으로 안건·결정사항을 정리하는 채널"
      />
      <div className="flex-1 overflow-y-auto p-6">
        {!isSummarizerConfigured() && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            자동 요약이 아직 설정되지 않았습니다 (ANTHROPIC_API_KEY 미설정). 새 회의록이 있어도 자동으로 추가되지 않습니다.
          </p>
        )}
        {sync.added > 0 && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
            새 회의록 {sync.added}건을 자동으로 정리했습니다.
          </p>
        )}
        {sync.failed > 0 && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            일부 회의록({sync.failed}건)은 자동 정리에 실패했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        {meetings.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
            정리된 회의가 아직 없습니다.
          </p>
        ) : (
          <ArchiveBrowser meetings={meetings} selected={selected} />
        )}
      </div>
    </>
  );
}

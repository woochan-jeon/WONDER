import ChannelHeader from "@/components/channel-header";
import CertTracker from "@/components/cert-tracker-loader";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/calendar-grid";

export default async function CertificationPage() {
  const members = await prisma.certMember.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      langScores: { orderBy: { createdAt: "asc" } },
      exhibitions: { orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] },
    },
  });

  return (
    <>
      <ChannelHeader icon="🎖️" title="장관인증요건" description="개인별 장관인증 조건 5가지의 충족 여부를 확인하는 채널" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <CertTracker
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            gpaOk: m.gpaOk,
            gpaCheckedAt: m.gpaCheckedAt ? toDateKey(m.gpaCheckedAt) : null,
            reportSubmitted: m.reportSubmitted,
            certGukmusa1: m.certGukmusa1,
            certTradeEnglish1: m.certTradeEnglish1,
            certLogistics: m.certLogistics,
            certDistribution1: m.certDistribution1,
            certDistribution2: m.certDistribution2,
            certImportManager: m.certImportManager,
            langScores: m.langScores.map((s) => ({ id: s.id, exam: s.exam, grade: s.grade, score: s.score })),
            exhibitions: m.exhibitions.map((e) => ({
              id: e.id,
              name: e.name,
              location: e.location,
              startDate: toDateKey(e.startDate),
              endDate: toDateKey(e.endDate),
              hours: e.hours,
            })),
          }))}
        />
      </div>
    </>
  );
}

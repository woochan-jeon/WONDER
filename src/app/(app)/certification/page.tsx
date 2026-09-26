import ChannelHeader from "@/components/channel-header";
import CertTracker from "@/components/cert-tracker-loader";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/calendar-grid";
import { CERT_FIELDS, TEAM_FIELDS, type CertField, type TeamField } from "@/lib/minister-cert";

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
      <ChannelHeader icon="🎖️" title="장관인증요건" description="개인별 장관인증(지역무역전문가 인증서) 조건 6가지의 충족 여부를 확인하는 채널" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <CertTracker
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            gtepCompleted: m.gtepCompleted,
            gpaOk: m.gpaOk,
            gpaCheckedAt: m.gpaCheckedAt ? toDateKey(m.gpaCheckedAt) : null,
            gpaSemesterOk: m.gpaSemesterOk,
            gpaSemesterCheckedAt: m.gpaSemesterCheckedAt ? toDateKey(m.gpaSemesterCheckedAt) : null,
            reportSubmitted: m.reportSubmitted,
            ...(Object.fromEntries(TEAM_FIELDS.map((f) => [f, m[f]])) as Record<TeamField, boolean>),
            ...(Object.fromEntries(CERT_FIELDS.map((f) => [f, m[f]])) as Record<CertField, boolean>),
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

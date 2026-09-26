import Link from "next/link";
import ChannelHeader from "@/components/channel-header";
import TimestampBoard from "@/components/timestamp-board";
import { getConnectionStatus, isGoogleOAuthConfigured } from "@/lib/google-calendar";
import { SheetsScopeError } from "@/lib/google-sheets";
import { TimestampSheetMissingError, readTimestampTab, timestampSheetUrl, type TimestampTabData } from "@/lib/timestamp-sheet";
import { TIMESTAMP_TABS, isTimestampTab } from "@/lib/timestamp";

export default async function TimestampPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab = isTimestampTab(params.tab) ? params.tab : TIMESTAMP_TABS[0];

  const status = await getConnectionStatus();
  const oauthConfigured = isGoogleOAuthConfigured();

  let data: TimestampTabData | null = null;
  let problem: string | null = null;
  if (status.connected) {
    try {
      data = await readTimestampTab(tab);
    } catch (err) {
      if (err instanceof SheetsScopeError) {
        problem = "연결된 구글 계정에 시트 접근 권한이 없습니다. 구글 계정을 다시 연결하면 시트 접근 동의가 함께 요청됩니다.";
      } else if (err instanceof TimestampSheetMissingError) {
        problem = `${err.message}. 시트가 삭제되었거나 연결된 구글 계정(${status.googleEmail})과 공유되지 않았는지 확인해 주세요.`;
      } else {
        throw err;
      }
    }
  }

  return (
    <>
      <ChannelHeader
        icon="⏱️"
        title="타임스탬프"
        description="팀전 · 제니홍 · 페네핏 프로젝트별 진행 타임라인 (구글 시트와 연동)"
        action={
          <a
            href={timestampSheetUrl(data?.gid)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50"
          >
            구글 시트에서 열기 →
          </a>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <nav className="mb-4 flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 sm:w-fit">
          {TIMESTAMP_TABS.map((t) => (
            <Link
              key={t}
              href={`/timestamp?tab=${encodeURIComponent(t)}`}
              className={`flex-1 rounded-md px-4 py-1.5 text-center text-sm transition-colors sm:flex-none ${
                t === tab ? "bg-[#0066cc] font-medium text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t}
            </Link>
          ))}
        </nav>

        {!status.connected ? (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            타임스탬프 채널은 구글 시트를 직접 읽고 씁니다. 캘린더 채널과 같은 구글 계정 연결이 필요합니다.{" "}
            {oauthConfigured ? (
              <a href="/api/calendar/oauth/start" className="font-medium text-[#0066cc] hover:underline">
                구글 계정 연결하기
              </a>
            ) : (
              "README의 안내에 따라 Google Cloud OAuth 설정을 먼저 완료해 주세요."
            )}
          </p>
        ) : problem ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {problem}{" "}
            <a href="/api/calendar/oauth/start" className="font-medium underline">
              구글 계정 다시 연결하기
            </a>
          </p>
        ) : data ? (
          <TimestampBoard key={tab} tab={tab} entries={data.entries} />
        ) : null}
      </div>
    </>
  );
}

import ChannelHeader from "@/components/channel-header";
import LedgerBoard from "@/components/ledger-board";
import { getConnectionStatus, isGoogleOAuthConfigured } from "@/lib/google-calendar";
import {
  LEDGER_PROJECTS,
  SheetsScopeError,
  ledgerSheetUrl,
  listLedgerEntries,
  type LedgerEntry,
} from "@/lib/google-sheets";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const status = await getConnectionStatus();
  const oauthConfigured = isGoogleOAuthConfigured();

  const project = LEDGER_PROJECTS.find((p) => p.id === params.project) ?? LEDGER_PROJECTS[0];

  let entries: LedgerEntry[] = [];
  let scopeError = false;
  if (status.connected) {
    try {
      entries = await listLedgerEntries(project);
    } catch (err) {
      if (err instanceof SheetsScopeError) scopeError = true;
      else throw err;
    }
  }

  return (
    <>
      <ChannelHeader icon="💰" title="회계장부" description="구글 시트와 연동된 팀 회계장부" />
      <div className="flex-1 overflow-y-auto p-6">
        {!status.connected ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-600">아직 팀 구글 계정이 연결되지 않았습니다.</p>
            <p className="text-xs text-gray-400">
              캘린더 채널과 같은 구글 계정 연결을 사용합니다. 캘린더 채널에서 먼저 연결해 주세요.
            </p>
            {oauthConfigured && (
              <a
                href="/api/calendar/oauth/start"
                className="mt-2 rounded-md bg-[#002D56] px-4 py-2 text-sm font-medium text-white hover:bg-[#00203C]"
              >
                구글 계정 연결하기
              </a>
            )}
          </div>
        ) : scopeError ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-600">연결된 구글 계정에 시트 접근 권한이 없습니다.</p>
            <p className="text-xs text-gray-400">
              회계장부 기능이 추가되기 전에 연결된 계정이라면 시트 권한이 없을 수 있어요. 재연결하면 시트
              접근 동의가 함께 요청됩니다.
            </p>
            <a
              href="/api/calendar/oauth/start"
              className="mt-2 rounded-md bg-[#002D56] px-4 py-2 text-sm font-medium text-white hover:bg-[#00203C]"
            >
              구글 계정 다시 연결하기
            </a>
          </div>
        ) : (
          <LedgerBoard
            projects={LEDGER_PROJECTS.map(({ id, label }) => ({ id, label }))}
            currentProjectId={project.id}
            sheetUrl={ledgerSheetUrl(project)}
            entries={entries}
          />
        )}
      </div>
    </>
  );
}

import ChannelHeader from "@/components/channel-header";
import { getConnectionStatus, isGoogleOAuthConfigured } from "@/lib/google-calendar";
import { DriveScopeError, getEmbedUrl, getMeetingMinutesDoc, type DriveItem } from "@/lib/google-drive";

export default async function MinutesPage() {
  const status = await getConnectionStatus();
  const oauthConfigured = isGoogleOAuthConfigured();

  let doc: DriveItem | null = null;
  let scopeError = false;

  if (status.connected) {
    try {
      doc = await getMeetingMinutesDoc();
    } catch (err) {
      if (err instanceof DriveScopeError) {
        scopeError = true;
      } else {
        throw err;
      }
    }
  }

  return (
    <>
      <ChannelHeader
        icon="📝"
        title="회의록"
        description={`드라이브의 "00. 회의록" 문서`}
        action={
          doc?.webViewLink ? (
            <a
              href={doc.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50"
            >
              원본 문서 열기 →
            </a>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {!status.connected ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-600">아직 팀 구글 드라이브가 연결되지 않았습니다.</p>
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
            <p className="text-sm text-gray-600">연결된 구글 계정에 드라이브 접근 권한이 없습니다.</p>
            <p className="text-xs text-gray-400">드라이브 채널에서 계정을 다시 연결해 주세요.</p>
            <a
              href="/api/calendar/oauth/start"
              className="mt-2 rounded-md bg-[#002D56] px-4 py-2 text-sm font-medium text-white hover:bg-[#00203C]"
            >
              구글 계정 다시 연결하기
            </a>
          </div>
        ) : !doc ? (
          <p className="rounded-md border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
            &ldquo;00. 회의록&rdquo; 문서를 찾지 못했어요.
          </p>
        ) : (
          <div className="h-[80vh] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <iframe src={getEmbedUrl(doc)} title={doc.name} className="h-full w-full" />
          </div>
        )}
      </div>
    </>
  );
}

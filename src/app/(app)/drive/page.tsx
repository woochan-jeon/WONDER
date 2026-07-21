import ChannelHeader from "@/components/channel-header";
import DriveBrowser from "@/components/drive-browser";
import { getConnectionStatus, isGoogleOAuthConfigured } from "@/lib/google-calendar";
import {
  DriveScopeError,
  getBreadcrumb,
  getDriveRootFolder,
  listDriveFiles,
  searchDriveFiles,
  type DriveItem,
  type DriveRootFolder,
} from "@/lib/google-drive";

export default async function DrivePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string; pickRoot?: string }>;
}) {
  const params = await searchParams;
  const status = await getConnectionStatus();
  const oauthConfigured = isGoogleOAuthConfigured();
  const pickingRoot = params.pickRoot === "1";
  const query = params.q?.trim();

  let items: DriveItem[] = [];
  let breadcrumb: { id: string; name: string }[] = [];
  let rootFolder: DriveRootFolder = null;
  let scopeError = false;
  let currentFolderId: string | null = null;

  if (status.connected) {
    try {
      rootFolder = await getDriveRootFolder();

      if (pickingRoot) {
        items = query ? await searchDriveFiles(query, { foldersOnly: true }) : [];
      } else {
        const folderId = params.folder || rootFolder?.id || "root";
        currentFolderId = folderId;
        [items, breadcrumb] = await Promise.all([
          query ? searchDriveFiles(query) : listDriveFiles(folderId),
          query ? Promise.resolve([]) : getBreadcrumb(folderId, rootFolder?.id),
        ]);
      }
    } catch (err) {
      if (err instanceof DriveScopeError) {
        scopeError = true;
      } else {
        throw err;
      }
    }
  }

  const driveFolderUrl =
    currentFolderId && currentFolderId !== "root"
      ? `https://drive.google.com/drive/folders/${currentFolderId}`
      : "https://drive.google.com/drive/my-drive";

  return (
    <>
      <ChannelHeader
        icon="🗂️"
        title="드라이브"
        description="구글 드라이브와 연동된 팀 자료"
        action={
          status.connected && !scopeError && !pickingRoot ? (
            <a
              href={driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50"
            >
              구글 드라이브에서 열기 →
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
            <p className="text-xs text-gray-400">
              캘린더 연동을 먼저 설정했던 계정이라면, 드라이브 권한이 추가되기 전에 연결된 것일 수 있어요.
              재연결하면 드라이브 접근 동의가 함께 요청됩니다.
            </p>
            <a
              href="/api/calendar/oauth/start"
              className="mt-2 rounded-md bg-[#002D56] px-4 py-2 text-sm font-medium text-white hover:bg-[#00203C]"
            >
              구글 계정 다시 연결하기
            </a>
          </div>
        ) : (
          <>
            {!pickingRoot && (
              <p className="mb-4 text-xs text-gray-400">{status.googleEmail} 계정의 드라이브</p>
            )}
            <DriveBrowser
              items={items}
              breadcrumb={breadcrumb}
              rootFolder={rootFolder}
              searchQuery={query}
              pickingRoot={pickingRoot}
            />
          </>
        )}
      </div>
    </>
  );
}

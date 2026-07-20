import Link from "next/link";
import type { BreadcrumbItem, DriveItem, DriveRootFolder } from "@/lib/google-drive";
import { clearDriveRootFolderAction, setDriveRootFolderAction } from "@/app/(app)/drive/actions";

function formatBytes(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes}B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)}${units[unitIndex]}`;
}

function formatModified(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function folderHref(folderId: string) {
  return `/drive?folder=${folderId}`;
}

export default function DriveBrowser({
  items,
  breadcrumb,
  rootFolder,
  isAdmin,
  searchQuery,
  pickingRoot,
}: {
  items: DriveItem[];
  breadcrumb: BreadcrumbItem[];
  rootFolder: DriveRootFolder;
  isAdmin: boolean;
  searchQuery?: string;
  pickingRoot: boolean;
}) {
  const homeLabel = rootFolder ? rootFolder.name : "내 드라이브";

  if (pickingRoot) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-900">루트로 사용할 폴더를 검색해 선택해 주세요</p>
          <Link href="/drive" className="text-sm text-[#002D56] hover:underline">
            취소
          </Link>
        </div>
        <form action="/drive" method="get" className="flex items-center gap-2">
          <input type="hidden" name="pickRoot" value="1" />
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="폴더 이름으로 검색"
            autoFocus
            className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
          />
          <button
            type="submit"
            className="rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C]"
          >
            검색
          </button>
        </form>

        {searchQuery && (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">일치하는 폴더가 없습니다.</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-gray-900">
                      <span aria-hidden>📁</span>
                      {item.name}
                    </span>
                    <form action={setDriveRootFolderAction.bind(null, item.id, item.name)}>
                      <button
                        type="submit"
                        className="rounded-md border border-[#002D56] px-2.5 py-1 text-xs font-medium text-[#002D56] hover:bg-[#002D56]/10"
                      >
                        이 폴더로 설정
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {searchQuery ? (
          <p className="text-sm text-gray-900">
            &ldquo;{searchQuery}&rdquo; 검색 결과 {items.length}건
          </p>
        ) : (
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <Link
              href="/drive"
              className={`rounded px-1.5 py-0.5 hover:bg-gray-100 ${
                breadcrumb.length === 0 ? "font-semibold text-gray-900" : "text-[#002D56]"
              }`}
            >
              {homeLabel}
            </Link>
            {breadcrumb.map((b, i) => (
              <span key={b.id} className="flex items-center gap-1">
                <span className="text-gray-300">/</span>
                <Link
                  href={folderHref(b.id)}
                  className={`rounded px-1.5 py-0.5 hover:bg-gray-100 ${
                    i === breadcrumb.length - 1 ? "font-semibold text-gray-900" : "text-[#002D56]"
                  }`}
                >
                  {b.name}
                </Link>
              </span>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2 text-xs">
              <Link href="/drive?pickRoot=1" className="text-[#002D56] hover:underline">
                루트 폴더 변경
              </Link>
              {rootFolder && (
                <form action={clearDriveRootFolderAction}>
                  <button type="submit" className="text-gray-400 hover:text-red-600">
                    초기화
                  </button>
                </form>
              )}
            </div>
          )}
          <form action="/drive" method="get" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={searchQuery}
              placeholder="드라이브에서 검색"
              className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
            />
          </form>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          {searchQuery ? "검색 결과가 없습니다." : "이 폴더는 비어 있습니다."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-medium">이름</th>
                <th className="px-3 py-2 font-medium">수정일</th>
                <th className="px-3 py-2 font-medium">크기</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    {item.isFolder ? (
                      <Link
                        href={folderHref(item.id)}
                        className="flex items-center gap-2 text-gray-900 hover:text-[#002D56]"
                      >
                        <span aria-hidden>📁</span>
                        <span className="truncate">{item.name}</span>
                      </Link>
                    ) : (
                      <a
                        href={item.webViewLink ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-900 hover:text-[#002D56]"
                      >
                        {item.iconLink ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.iconLink} alt="" className="h-4 w-4" />
                        ) : (
                          <span aria-hidden>📄</span>
                        )}
                        <span className="truncate">{item.name}</span>
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{formatModified(item.modifiedTime)}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {item.isFolder ? "" : formatBytes(item.sizeBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

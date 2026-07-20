import "server-only";
import { google, drive_v3 } from "googleapis";
import { getAuthorizedClient } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut";

const LIST_FIELDS =
  "files(id, name, mimeType, iconLink, webViewLink, modifiedTime, size, shortcutDetails)";

export type DriveItem = {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  iconLink: string | null;
  webViewLink: string | null;
  modifiedTime: string | null;
  sizeBytes: number | null;
  // Present when this item is a shortcut (💠) pointing at another file —
  // embedding/opening should use the target, not the shortcut itself.
  shortcutTargetId: string | null;
  shortcutTargetMimeType: string | null;
};

export type BreadcrumbItem = { id: string; name: string };

/**
 * Thrown when the connected Google account's token doesn't have Drive access
 * yet — e.g. it was connected before the `drive.readonly` scope was added.
 * The admin needs to reconnect (disconnect + connect again) to re-consent.
 */
export class DriveScopeError extends Error {
  constructor() {
    super("The connected Google account has not granted Drive access.");
    this.name = "DriveScopeError";
  }
}

function isInsufficientScope(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 403;
}

function getDriveClient(client: Awaited<ReturnType<typeof getAuthorizedClient>>) {
  if (!client) return null;
  return google.drive({ version: "v3", auth: client.client });
}

function toDriveItem(f: drive_v3.Schema$File): DriveItem | null {
  if (!f.id || !f.name) return null;
  return {
    id: f.id,
    name: f.name,
    isFolder: f.mimeType === FOLDER_MIME_TYPE,
    mimeType: f.mimeType ?? "",
    iconLink: f.iconLink ?? null,
    webViewLink: f.webViewLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    sizeBytes: f.size ? Number(f.size) : null,
    shortcutTargetId: f.mimeType === SHORTCUT_MIME_TYPE ? (f.shortcutDetails?.targetId ?? null) : null,
    shortcutTargetMimeType:
      f.mimeType === SHORTCUT_MIME_TYPE ? (f.shortcutDetails?.targetMimeType ?? null) : null,
  };
}

/** Google Docs/Sheets/Slides/Drive support an embeddable per-file preview iframe. */
export function getEmbedUrl(item: DriveItem): string {
  const id = item.shortcutTargetId ?? item.id;
  const mimeType = item.shortcutTargetMimeType ?? item.mimeType;
  switch (mimeType) {
    case "application/vnd.google-apps.document":
      return `https://docs.google.com/document/d/${id}/preview`;
    case "application/vnd.google-apps.spreadsheet":
      return `https://docs.google.com/spreadsheets/d/${id}/preview`;
    case "application/vnd.google-apps.presentation":
      return `https://docs.google.com/presentation/d/${id}/preview`;
    default:
      return `https://drive.google.com/file/d/${id}/preview`;
  }
}

/** The team's single master "00. 회의록" document, for the # 회의록 channel. */
export async function getMeetingMinutesDoc(): Promise<DriveItem | null> {
  const authorized = await getAuthorizedClient();
  const drive = getDriveClient(authorized);
  if (!drive) return null;

  try {
    const { data } = await drive.files.list({
      q: `name = '00. 회의록' and trashed = false and mimeType != '${FOLDER_MIME_TYPE}'`,
      fields: LIST_FIELDS,
      pageSize: 1,
    });
    const item = data.files?.[0];
    return item ? toDriveItem(item) : null;
  } catch (err) {
    if (isInsufficientScope(err)) throw new DriveScopeError();
    throw err;
  }
}

export type DriveRootFolder = { id: string; name: string } | null;

/** The folder the # 드라이브 channel is scoped to. Null means "My Drive" root. */
export async function getDriveRootFolder(): Promise<DriveRootFolder> {
  const connection = await prisma.calendarConnection.findFirst();
  if (!connection?.driveRootFolderId || !connection.driveRootFolderName) return null;
  return { id: connection.driveRootFolderId, name: connection.driveRootFolderName };
}

export async function setDriveRootFolder(folderId: string, folderName: string) {
  const connection = await prisma.calendarConnection.findFirst();
  if (!connection) throw new Error("연결된 구글 계정이 없습니다");
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { driveRootFolderId: folderId, driveRootFolderName: folderName },
  });
}

export async function clearDriveRootFolder() {
  const connection = await prisma.calendarConnection.findFirst();
  if (!connection) return;
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { driveRootFolderId: null, driveRootFolderName: null },
  });
}

/** Lists the contents of a Drive folder. `folderId` defaults to "root" (My Drive). */
export async function listDriveFiles(folderId = "root"): Promise<DriveItem[]> {
  const authorized = await getAuthorizedClient();
  const drive = getDriveClient(authorized);
  if (!drive) return [];

  try {
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: LIST_FIELDS,
      orderBy: "folder,name_natural",
      pageSize: 200,
    });
    return (data.files ?? []).map(toDriveItem).filter((f): f is DriveItem => f !== null);
  } catch (err) {
    if (isInsufficientScope(err)) throw new DriveScopeError();
    throw err;
  }
}

/**
 * Walks up from `folderId` to build a breadcrumb trail. Stops at `stopAtFolderId`
 * (the configured Drive channel root) if given, otherwise walks to My Drive root.
 * The stopping folder itself is not included — the "home" link represents it.
 */
export async function getBreadcrumb(
  folderId: string,
  stopAtFolderId?: string,
): Promise<BreadcrumbItem[]> {
  const authorized = await getAuthorizedClient();
  const drive = getDriveClient(authorized);
  if (!drive || folderId === "root" || folderId === stopAtFolderId) return [];

  const trail: BreadcrumbItem[] = [];
  let currentId: string | undefined = folderId;
  let guard = 0;

  while (currentId && currentId !== "root" && currentId !== stopAtFolderId && guard < 20) {
    guard++;
    let data: drive_v3.Schema$File;
    try {
      ({ data } = await drive.files.get({ fileId: currentId, fields: "id, name, parents" }));
    } catch (err) {
      if (isInsufficientScope(err)) throw new DriveScopeError();
      break;
    }
    if (!data.id || !data.name) break;
    trail.unshift({ id: data.id, name: data.name });
    currentId = data.parents?.[0];
  }

  return trail;
}

/** Finds the "Meet Recordings" folder under the configured Drive root (or anywhere in Drive if no root is set). */
export async function findMeetRecordingsFolder(): Promise<DriveItem | null> {
  const authorized = await getAuthorizedClient();
  const drive = getDriveClient(authorized);
  if (!drive) return null;

  const root = await getDriveRootFolder();
  const parentClause = root ? ` and '${root.id}' in parents` : "";

  try {
    const { data } = await drive.files.list({
      q: `mimeType = '${FOLDER_MIME_TYPE}' and name = 'Meet Recordings' and trashed = false${parentClause}`,
      fields: LIST_FIELDS,
      pageSize: 1,
    });
    const item = data.files?.[0];
    return item ? toDriveItem(item) : null;
  } catch (err) {
    if (isInsufficientScope(err)) throw new DriveScopeError();
    throw err;
  }
}

/** Gemini auto-names meeting-minutes docs with this suffix — distinguishes them from Transcripts and other files in the folder. */
const GEMINI_MINUTES_MARKER = "Gemini가 작성한 회의록";

/** Gemini meeting-minutes documents inside the "Meet Recordings" folder, newest first. */
export async function listMeetRecordingsMinutes(): Promise<DriveItem[]> {
  const folder = await findMeetRecordingsFolder();
  if (!folder) return [];

  const authorized = await getAuthorizedClient();
  const drive = getDriveClient(authorized);
  if (!drive) return [];

  try {
    const { data } = await drive.files.list({
      q: `'${folder.id}' in parents and trashed = false and name contains '${GEMINI_MINUTES_MARKER}'`,
      fields: LIST_FIELDS,
      orderBy: "modifiedTime desc",
      pageSize: 100,
    });
    return (data.files ?? []).map(toDriveItem).filter((f): f is DriveItem => f !== null);
  } catch (err) {
    if (isInsufficientScope(err)) throw new DriveScopeError();
    throw err;
  }
}

/** Exports a Google Doc's content as plain text (used to feed the meeting summarizer). */
export async function exportDocText(fileId: string): Promise<string> {
  const authorized = await getAuthorizedClient();
  const drive = getDriveClient(authorized);
  if (!drive) throw new Error("연결된 구글 계정이 없습니다");

  try {
    const res = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" },
    );
    return res.data as unknown as string;
  } catch (err) {
    if (isInsufficientScope(err)) throw new DriveScopeError();
    throw err;
  }
}

/** Parses the meeting start time Gemini embeds in the filename, e.g. "2026/07/15 12:24 KST에 시작한 회의 - ...". */
export function parseMeetingDateFromName(name: string): Date | null {
  const match = name.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s*KST/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  // KST is UTC+9 with no DST — construct the UTC instant directly.
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh) - 9, Number(mm)));
}

export async function searchDriveFiles(
  query: string,
  options?: { foldersOnly?: boolean },
): Promise<DriveItem[]> {
  const authorized = await getAuthorizedClient();
  const drive = getDriveClient(authorized);
  if (!drive || !query.trim()) return [];

  const escaped = query.replace(/[\\']/g, "\\$&");
  const folderClause = options?.foldersOnly
    ? ` and mimeType = '${FOLDER_MIME_TYPE}'`
    : "";
  try {
    const { data } = await drive.files.list({
      q: `name contains '${escaped}' and trashed = false${folderClause}`,
      fields: LIST_FIELDS,
      orderBy: "folder,name_natural",
      pageSize: 50,
    });
    return (data.files ?? []).map(toDriveItem).filter((f): f is DriveItem => f !== null);
  } catch (err) {
    if (isInsufficientScope(err)) throw new DriveScopeError();
    throw err;
  }
}

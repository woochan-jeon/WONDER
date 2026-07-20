import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DriveScopeError,
  exportDocText,
  listMeetRecordingsMinutes,
  parseMeetingDateFromName,
} from "@/lib/google-drive";
import { isSummarizerConfigured, summarizeMeetingMinutes } from "@/lib/meeting-summarizer";

function formatTitle(date: Date) {
  // Meeting dates are stored as their KST wall-clock instant (see
  // parseMeetingDateFromName), so reading UTC getters back out here is correct.
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일의 회의록`;
}

export type SyncResult = { added: number; skipped: number; failed: number };

/**
 * Scans the Drive "Meet Recordings" folder for Gemini meeting-minutes docs not
 * yet in the archive, summarizes each into agenda/decision pairs via Claude,
 * and stores them. Safe to call repeatedly — already-archived docs are skipped.
 */
export async function syncMeetingArchive(): Promise<SyncResult> {
  if (!isSummarizerConfigured()) return { added: 0, skipped: 0, failed: 0 };

  let candidates;
  try {
    candidates = await listMeetRecordingsMinutes();
  } catch (err) {
    if (err instanceof DriveScopeError) return { added: 0, skipped: 0, failed: 0 };
    throw err;
  }
  if (candidates.length === 0) return { added: 0, skipped: 0, failed: 0 };

  const existingIds = new Set(
    (
      await prisma.meetingSummary.findMany({
        where: { driveFileId: { in: candidates.map((c) => c.id) } },
        select: { driveFileId: true },
      })
    ).map((r) => r.driveFileId),
  );

  const newDocs = candidates.filter((c) => !existingIds.has(c.id));
  let added = 0;
  let failed = 0;

  for (const doc of newDocs) {
    try {
      const text = await exportDocText(doc.id);
      const items = await summarizeMeetingMinutes(text);
      const meetingDate = parseMeetingDateFromName(doc.name) ?? new Date(doc.modifiedTime ?? Date.now());

      // upsert (not create) guards against a race if two people load the
      // archive page concurrently and both start summarizing the same doc.
      await prisma.meetingSummary.upsert({
        where: { driveFileId: doc.id },
        create: {
          driveFileId: doc.id,
          meetingDate,
          title: formatTitle(meetingDate),
          itemsJson: JSON.stringify(items),
          sourceUrl: doc.webViewLink,
        },
        update: {},
      });
      added++;
    } catch (err) {
      // One bad doc (e.g. malformed AI response) shouldn't block the rest of the sync.
      console.error(`Failed to summarize meeting doc ${doc.id} (${doc.name}):`, err);
      failed++;
    }
  }

  return { added, skipped: existingIds.size, failed };
}

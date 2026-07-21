-- AlterTable
ALTER TABLE "CalendarConnection" ADD COLUMN "calendarIds" TEXT NOT NULL DEFAULT '["primary"]';

-- Backfill existing rows from the old single calendarId column.
UPDATE "CalendarConnection" SET "calendarIds" = '["' || "calendarId" || '"]';

-- AlterTable
ALTER TABLE "CalendarConnection" DROP COLUMN "calendarId";

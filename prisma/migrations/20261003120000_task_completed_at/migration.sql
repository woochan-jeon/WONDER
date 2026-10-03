-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Tasks already marked done get their last update time as a best guess.
UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE';

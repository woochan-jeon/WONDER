-- Drop the assignee join table (accounts removed; assignees are now free text)
DROP TABLE "_AssignedTasks";

-- Task: replace user-linked fields with free text
ALTER TABLE "Task" DROP COLUMN "createdById";
ALTER TABLE "Task" ADD COLUMN "assigneeNames" TEXT NOT NULL DEFAULT '[]';

-- CalendarConnection: no longer tracks which account connected it
ALTER TABLE "CalendarConnection" DROP COLUMN "connectedById";

-- Remove the account system entirely
DROP TABLE "User";
DROP TYPE "Role";

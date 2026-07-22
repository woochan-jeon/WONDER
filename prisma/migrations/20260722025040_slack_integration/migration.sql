-- AlterTable
ALTER TABLE "Task" ADD COLUMN "slackChannelId" TEXT;
ALTER TABLE "Task" ADD COLUMN "slackChannelName" TEXT;

-- CreateTable
CREATE TABLE "SlackConnection" (
    "id" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

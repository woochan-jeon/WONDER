import ChannelHeader from "@/components/channel-header";
import TaskBoard from "@/components/task-board";
import { prisma } from "@/lib/prisma";
import { disconnectSlackAction } from "./actions";
import { getSlackConnectionStatus, isSlackConfigured, listSlackChannels } from "@/lib/slack";

const SLACK_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "슬랙 인증에 실패했습니다. 다시 시도해 주세요.",
  token_exchange_failed: "슬랙과 연결하는 중 오류가 발생했습니다. 다시 시도해 주세요.",
  access_denied: "슬랙에서 접근을 거부했습니다.",
  not_configured: "아직 Slack App 설정이 완료되지 않았습니다. README를 참고해 설정해 주세요.",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ slackConnected?: string; slackError?: string }>;
}) {
  const params = await searchParams;
  const slackStatus = await getSlackConnectionStatus();
  const slackConfigured = isSlackConfigured();
  const slackErrorMessage = params.slackError
    ? SLACK_ERROR_MESSAGES[params.slackError] ?? "알 수 없는 오류가 발생했습니다."
    : null;

  const [rows, categories, slackChannels] = await Promise.all([
    prisma.task.findMany({
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.category.findMany({
      orderBy: { createdAt: "asc" },
    }),
    slackStatus.connected ? listSlackChannels() : Promise.resolve([]),
  ]);

  const tasks = rows.map((r) => ({ ...r, assignees: JSON.parse(r.assigneeNames) as string[] }));

  return (
    <>
      <ChannelHeader
        icon="✅"
        title="할일"
        description="팀 할일을 관리하는 채널"
        action={
          slackStatus.connected ? (
            <form action={disconnectSlackAction}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                슬랙 연결 해제 ({slackStatus.teamName})
              </button>
            </form>
          ) : slackConfigured ? (
            <a
              href="/api/slack/oauth/start"
              className="rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C]"
            >
              슬랙 연결
            </a>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {slackErrorMessage && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{slackErrorMessage}</p>
        )}
        {params.slackConnected === "1" && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            슬랙 워크스페이스가 연결됐습니다.
          </p>
        )}
        <TaskBoard tasks={tasks} categories={categories} slackChannels={slackChannels} />
      </div>
    </>
  );
}

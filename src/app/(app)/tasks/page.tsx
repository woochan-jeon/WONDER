import ChannelHeader from "@/components/channel-header";
import TaskBoard from "@/components/task-board";
import { prisma } from "@/lib/prisma";

export default async function TasksPage() {
  const [rows, categories] = await Promise.all([
    prisma.task.findMany({
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.category.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const tasks = rows.map((r) => ({ ...r, assignees: JSON.parse(r.assigneeNames) as string[] }));

  return (
    <>
      <ChannelHeader icon="✅" title="할일" description="팀 할일을 관리하는 채널" />
      <div className="flex-1 overflow-y-auto p-6">
        <TaskBoard tasks={tasks} categories={categories} />
      </div>
    </>
  );
}

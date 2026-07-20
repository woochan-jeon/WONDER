import ChannelHeader from "@/components/channel-header";
import TaskBoard from "@/components/task-board";
import { prisma } from "@/lib/prisma";

export default async function TasksPage() {
  const [tasks, users, categories] = await Promise.all([
    prisma.task.findMany({
      include: {
        assignees: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <>
      <ChannelHeader icon="✅" title="할일" description="팀 할일을 관리하는 채널" />
      <div className="flex-1 overflow-y-auto p-6">
        <TaskBoard tasks={tasks} users={users} categories={categories} />
      </div>
    </>
  );
}

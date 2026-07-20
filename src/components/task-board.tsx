"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  createTaskAction,
  updateTaskAction,
  setTaskStatusAction,
  deleteTaskAction,
  createCategoryAction,
  deleteCategoryAction,
  type ActionState,
} from "@/app/(app)/tasks/actions";

type TeamUser = { id: string; name: string };
type Category = { id: string; name: string; color: string };

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: Date | null;
  assignees: TeamUser[];
  createdBy: TeamUser;
  category: Category | null;
};

const STATUS_COLUMNS: { status: Task["status"]; label: string; badgeClass: string }[] = [
  { status: "TODO", label: "할 일", badgeClass: "bg-gray-100 text-gray-700" },
  { status: "IN_PROGRESS", label: "진행 중", badgeClass: "bg-blue-100 text-blue-700" },
  { status: "DONE", label: "완료", badgeClass: "bg-green-100 text-green-700" },
];

const CATEGORY_COLOR_SWATCHES = [
  "#002D56",
  "#8D7150",
  "#9D9FA2",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
];

const initialState: ActionState = {};

function formatDueDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${category.color}1a`, color: category.color }}
    >
      {category.name}
    </span>
  );
}

function CategorySelect({
  categories,
  defaultValue,
  className,
}: {
  categories: Category[];
  defaultValue?: string;
  className: string;
}) {
  return (
    <select name="categoryId" defaultValue={defaultValue ?? ""} className={className}>
      <option value="">카테고리 없음</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function AssigneePicker({
  users,
  defaultSelectedIds,
}: {
  users: TeamUser[];
  defaultSelectedIds?: string[];
}) {
  if (users.length === 0) {
    return <span className="text-xs text-gray-500">등록된 팀원이 없습니다</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {users.map((u) => (
        <label
          key={u.id}
          className="flex items-center gap-1.5 rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-900 has-[:checked]:border-[#002D56] has-[:checked]:bg-[#002D56]/10 has-[:checked]:text-[#002D56]"
        >
          <input
            type="checkbox"
            name="assigneeIds"
            value={u.id}
            defaultChecked={defaultSelectedIds?.includes(u.id)}
            className="h-3 w-3 accent-[#002D56]"
          />
          {u.name}
        </label>
      ))}
    </div>
  );
}

export default function TaskBoard({
  tasks,
  users,
  categories,
}: {
  tasks: Task[];
  users: TeamUser[];
  categories: Category[];
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visibleTasks = useMemo(
    () => (activeCategoryId ? tasks.filter((t) => t.category?.id === activeCategoryId) : tasks),
    [tasks, activeCategoryId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-900">총 {visibleTasks.length}개의 할일</p>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C]"
        >
          {showNewForm ? "닫기" : "+ 새 할일"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            activeCategoryId === null
              ? "border-[#002D56] bg-[#002D56] text-white"
              : "border-gray-200 text-gray-900 hover:bg-gray-50"
          }`}
        >
          전체
        </button>
        {categories.map((c) => {
          const active = activeCategoryId === c.id;
          return (
            <span
              key={c.id}
              className="group flex items-center gap-1 rounded-full border px-1 py-1 text-xs"
              style={{ borderColor: active ? c.color : "#e5e7eb" }}
            >
              <button
                onClick={() => setActiveCategoryId(active ? null : c.id)}
                className="rounded-full px-2 py-0.5 font-medium"
                style={{ color: active ? c.color : "#111827" }}
              >
                {c.name}
              </button>
              <button
                onClick={() => {
                  if (confirm(`"${c.name}" 카테고리를 삭제할까요?`)) {
                    startTransition(() => deleteCategoryAction(c.id));
                    if (active) setActiveCategoryId(null);
                  }
                }}
                title="카테고리 삭제"
                className="hidden pr-1 text-gray-400 hover:text-red-600 group-hover:block"
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          onClick={() => setShowCategoryForm((v) => !v)}
          className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-900 hover:bg-gray-50"
        >
          {showCategoryForm ? "닫기" : "+ 카테고리"}
        </button>
      </div>

      {showCategoryForm && <NewCategoryForm onDone={() => setShowCategoryForm(false)} />}

      {showNewForm && (
        <NewTaskForm users={users} categories={categories} onDone={() => setShowNewForm(false)} />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STATUS_COLUMNS.map((col) => (
          <div key={col.status} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${col.badgeClass}`}>
                {col.label}
              </span>
              <span className="text-xs text-gray-900">
                {visibleTasks.filter((t) => t.status === col.status).length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {visibleTasks
                .filter((t) => t.status === col.status)
                .map((task) => (
                  <TaskCard key={task.id} task={task} users={users} categories={categories} />
                ))}
              {visibleTasks.filter((t) => t.status === col.status).length === 0 && (
                <p className="rounded-md border border-dashed border-gray-200 p-4 text-center text-xs text-gray-900">
                  할일 없음
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewCategoryForm({ onDone }: { onDone: () => void }) {
  const [color, setColor] = useState(CATEGORY_COLOR_SWATCHES[0]);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createCategoryAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <input type="hidden" name="color" value={color} />
      <input
        name="name"
        placeholder="카테고리 이름"
        required
        autoFocus
        maxLength={30}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />
      <div className="flex items-center gap-1.5">
        {CATEGORY_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => setColor(swatch)}
            aria-label={swatch}
            className={`h-5 w-5 rounded-full ${color === swatch ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="ml-auto rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C] disabled:opacity-60"
      >
        {pending ? "추가 중..." : "추가"}
      </button>
    </form>
  );
}

function NewTaskForm({
  users,
  categories,
  onDone,
}: {
  users: TeamUser[];
  categories: Category[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createTaskAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <input
        name="title"
        placeholder="할일 제목"
        required
        autoFocus
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />
      <textarea
        name="description"
        placeholder="설명 (선택)"
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />
      <div>
        <p className="mb-1 text-xs text-gray-500">담당자 (여러 명 선택 가능)</p>
        <AssigneePicker users={users} />
      </div>
      <div className="flex flex-wrap gap-3">
        <CategorySelect
          categories={categories}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
        <input
          type="date"
          name="dueDate"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C] disabled:opacity-60"
        >
          {pending ? "추가 중..." : "추가"}
        </button>
      </div>
    </form>
  );
}

function TaskCard({
  task,
  users,
  categories,
}: {
  task: Task;
  users: TeamUser[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dueLabel = formatDueDate(task.dueDate);

  if (editing) {
    return (
      <EditTaskForm
        task={task}
        users={users}
        categories={categories}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => setEditing(true)}
            title="수정"
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✏️
          </button>
          <button
            onClick={() => {
              if (confirm("이 할일을 삭제할까요?")) {
                startTransition(() => deleteTaskAction(task.id));
              }
            }}
            title="삭제"
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-600"
          >
            🗑️
          </button>
        </div>
      </div>

      {task.category && <CategoryBadge category={task.category} />}

      {task.description && <p className="text-xs text-gray-900">{task.description}</p>}

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {task.assignees.length > 0 ? (
            task.assignees.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1 rounded-full bg-[#002D56]/10 px-2 py-0.5 text-xs text-[#002D56]"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#002D56] text-[9px] font-semibold text-white">
                  {a.name.slice(0, 1).toUpperCase()}
                </span>
                {a.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-900">담당자 없음</span>
          )}
          {dueLabel && <span className="text-xs text-gray-900">· {dueLabel}</span>}
        </div>

        <select
          value={task.status}
          disabled={isPending}
          onChange={(e) => startTransition(() => setTaskStatusAction(task.id, e.target.value))}
          className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-900 outline-none"
        >
          {STATUS_COLUMNS.map((c) => (
            <option key={c.status} value={c.status}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function EditTaskForm({
  task,
  users,
  categories,
  onDone,
}: {
  task: Task;
  users: TeamUser[];
  categories: Category[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updateTaskAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border border-[#002D56] bg-gray-50 p-3"
    >
      <input type="hidden" name="taskId" value={task.id} />
      <input
        name="title"
        defaultValue={task.title}
        required
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />
      <textarea
        name="description"
        defaultValue={task.description ?? ""}
        rows={2}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />
      <div>
        <p className="mb-1 text-xs text-gray-500">담당자 (여러 명 선택 가능)</p>
        <AssigneePicker users={users} defaultSelectedIds={task.assignees.map((a) => a.id)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <CategorySelect
          categories={categories}
          defaultValue={task.category?.id}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none"
        />
        <input
          type="date"
          name="dueDate"
          defaultValue={toDateInputValue(task.dueDate)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none"
        />
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#002D56] px-2 py-1 text-xs font-medium text-white hover:bg-[#00203C] disabled:opacity-60"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}

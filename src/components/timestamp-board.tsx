"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import {
  createEntryAction,
  deleteEntryAction,
  updateEntryAction,
  type ActionState,
} from "@/app/(app)/timestamp/actions";
import type { TimestampEntry, TimestampTab } from "@/lib/timestamp";

const initialState: ActionState = {};

const inputClass =
  "rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type MonthGroup = { key: string; label: string; entries: TimestampEntry[] };

// Groups entries by month in chronological order; rows whose date cell
// couldn't be read as a date collect in a trailing "날짜 미정" group.
function groupByMonth(entries: TimestampEntry[]): MonthGroup[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.dateValid !== b.dateValid) return a.dateValid ? -1 : 1;
    return a.date.localeCompare(b.date) || a.row - b.row;
  });
  const groups: MonthGroup[] = [];
  for (const entry of sorted) {
    const key = entry.dateValid ? entry.date.slice(0, 7) : "unknown";
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const label = entry.dateValid
        ? `${Number(entry.date.slice(0, 4))}년 ${Number(entry.date.slice(5, 7))}월`
        : "날짜 미정";
      group = { key, label, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

export default function TimestampBoard({ tab, entries }: { tab: TimestampTab; entries: TimestampEntry[] }) {
  const groups = useMemo(() => groupByMonth(entries), [entries]);
  const [editingRow, setEditingRow] = useState<number | null>(null);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <AddEntryForm tab={tab} />

      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 md:p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{tab} 타임라인</h2>
          <span className="text-xs text-gray-500">총 {entries.length}건</span>
        </div>

        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            아직 기록이 없습니다. 위에서 첫 타임스탬프를 추가해 보세요.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0066cc]">
                  {group.label}
                  <span className="ml-1.5 font-normal text-gray-400">{group.entries.length}</span>
                </h3>
                <ol className="relative ml-1.5 border-l-2 border-gray-200">
                  {group.entries.map((entry) =>
                    editingRow === entry.row ? (
                      <EditEntryForm key={entry.row} tab={tab} entry={entry} onDone={() => setEditingRow(null)} />
                    ) : (
                      <EntryItem key={entry.row} tab={tab} entry={entry} onEdit={() => setEditingRow(entry.row)} />
                    ),
                  )}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EntryItem({ tab, entry, onEdit }: { tab: TimestampTab; entry: TimestampEntry; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const weekday = entry.dateValid ? WEEKDAYS[new Date(`${entry.date}T00:00:00`).getDay()] : null;
  const dateLabel = entry.dateValid ? `${entry.date.slice(5, 7)}.${entry.date.slice(8, 10)}` : entry.date || "—";

  return (
    <li className={`group relative pb-4 pl-5 last:pb-0 ${pending ? "opacity-50" : ""}`}>
      <span
        className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#0066cc] ring-1 ring-[#0066cc]/30"
        aria-hidden
      />
      <div className="flex items-start gap-3">
        <div className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-gray-500">
          {dateLabel}
          {weekday && <span className="ml-1 text-gray-400">({weekday})</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{entry.content || "(내용 없음)"}</p>
          {entry.note && <p className="mt-0.5 text-xs text-gray-600">{entry.note}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            수정
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`"${entry.content}" 기록을 삭제할까요? 구글 시트에서도 삭제됩니다.`)) return;
              setError(null);
              startTransition(async () => {
                const result = await deleteEntryAction(tab, entry.row, { date: entry.date, content: entry.content });
                if (result.error) setError(result.error);
              });
            }}
            className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            삭제
          </button>
        </div>
      </div>
    </li>
  );
}

function AddEntryForm({ tab }: { tab: TimestampTab }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createEntryAction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
    >
      <input type="hidden" name="tab" value={tab} />
      <p className="text-xs font-semibold text-gray-700">새 타임스탬프 추가</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="date" name="date" required defaultValue={todayKey()} className={`${inputClass} sm:w-40`} />
        <input name="content" required maxLength={200} placeholder="내용 (예: MOU 체결 완료)" className={`${inputClass} flex-1`} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="note" maxLength={500} placeholder="비고 / 성과 (선택)" className={`${inputClass} flex-1`} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0066cc] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
        >
          {pending ? "저장 중..." : "추가"}
        </button>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function EditEntryForm({ tab, entry, onDone }: { tab: TimestampTab; entry: TimestampEntry; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updateEntryAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <li className="relative pb-4 pl-5 last:pb-0">
      <span
        className="absolute -left-[7px] top-2.5 h-3 w-3 rounded-full border-2 border-white bg-amber-500 ring-1 ring-amber-500/30"
        aria-hidden
      />
      <form action={formAction} className="flex flex-col gap-2 rounded-md bg-gray-50 p-3 ring-1 ring-gray-200">
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="row" value={entry.row} />
        <input type="hidden" name="expectedDate" value={entry.date} />
        <input type="hidden" name="expectedContent" value={entry.content} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="date"
            name="date"
            required
            defaultValue={entry.dateValid ? entry.date : ""}
            className={`${inputClass} bg-white sm:w-40`}
          />
          <input
            name="content"
            required
            maxLength={200}
            defaultValue={entry.content}
            className={`${inputClass} flex-1 bg-white`}
          />
        </div>
        <input
          name="note"
          maxLength={500}
          defaultValue={entry.note}
          placeholder="비고 / 성과 (선택)"
          className={`${inputClass} bg-white`}
        />
        <div className="flex items-center justify-end gap-2">
          {state.error && <p className="mr-auto text-xs text-red-600">{state.error}</p>}
          <button type="button" onClick={onDone} className="rounded-full px-3 py-1 text-xs text-gray-600 hover:bg-gray-200">
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[#0066cc] px-3 py-1 text-xs font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </li>
  );
}

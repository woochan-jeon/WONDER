"use client";

import { useActionState, useRef, useState } from "react";
import { createEventAction, selectCalendarsAction, type ActionState } from "@/app/(app)/calendar/actions";

type CalendarListItem = { id: string; name: string; primary: boolean };

const initialState: ActionState = {};

export function CalendarPicker({
  calendars,
  currentCalendarIds,
}: {
  calendars: CalendarListItem[];
  currentCalendarIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set(currentCalendarIds));
  const formRef = useRef<HTMLFormElement>(null);

  if (calendars.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // keep at least one selected
        next.delete(id);
      } else {
        next.add(id);
      }
      requestAnimationFrame(() => formRef.current?.requestSubmit());
      return next;
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 hover:bg-gray-50"
      >
        캘린더 ({selected.size}개 선택됨) ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <form
            ref={formRef}
            action={selectCalendarsAction}
            className="absolute right-0 z-20 mt-1 flex w-56 flex-col gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg"
          >
            {calendars.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-gray-900 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  name="calendarIds"
                  value={c.id}
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-3.5 w-3.5 accent-[#002D56]"
                />
                {c.name}
                {c.primary ? " (기본)" : ""}
              </label>
            ))}
          </form>
        </>
      )}
    </div>
  );
}

export function NewEventButton() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C]"
      >
        {open ? "닫기" : "+ 일정 추가"}
      </button>
      {open && <NewEventForm onDone={() => setOpen(false)} />}
    </div>
  );
}

function NewEventForm({ onDone }: { onDone: () => void }) {
  const [allDay, setAllDay] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createEventAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <input
        name="title"
        placeholder="일정 제목"
        required
        autoFocus
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />
      <textarea
        name="description"
        placeholder="설명 (선택)"
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          name="date"
          defaultValue={today}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-900">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#002D56]"
          />
          하루 종일
        </label>
        {!allDay && (
          <>
            <input
              type="time"
              name="startTime"
              required={!allDay}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
            />
            <span className="text-sm text-gray-500">~</span>
            <input
              type="time"
              name="endTime"
              required={!allDay}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
            />
          </>
        )}
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

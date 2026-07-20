"use client";

import { useActionState, useState } from "react";
import { createEventAction, selectCalendarAction, type ActionState } from "@/app/(app)/calendar/actions";

type CalendarListItem = { id: string; name: string; primary: boolean };

const initialState: ActionState = {};

export function CalendarPicker({
  calendars,
  currentCalendarId,
}: {
  calendars: CalendarListItem[];
  currentCalendarId: string;
}) {
  if (calendars.length === 0) return null;

  return (
    <form action={selectCalendarAction} className="flex items-center gap-2">
      <label className="text-xs text-gray-500">캘린더</label>
      <select
        name="calendarId"
        defaultValue={currentCalendarId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 outline-none focus:border-[#002D56]"
      >
        {calendars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.primary ? " (기본)" : ""}
          </option>
        ))}
      </select>
    </form>
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

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addLedgerEntryAction, updateLedgerEntryAction, type ActionState } from "@/app/(app)/ledger/actions";
import type { LedgerEntry } from "@/lib/google-sheets";

const PAYMENT_METHODS = ["계좌이체", "신용카드", "현금"];

const initialState: ActionState = {};

function formatWon(amount: number | null) {
  if (amount === null) return null;
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function todayDateValue() {
  return new Date().toLocaleDateString("sv-SE");
}

function nowTimeValue() {
  return new Date().toTimeString().slice(0, 5);
}

export default function LedgerBoard({
  projects,
  currentProjectId,
  sheetUrl,
  entries,
}: {
  projects: { id: string; label: string }[];
  currentProjectId: string;
  sheetUrl: string;
  entries: LedgerEntry[];
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const latestBalance = entries[0]?.balance ?? null;
  const editingEntry = entries.find((e) => e.row === editingRow) ?? null;

  function openNewForm() {
    setEditingRow(null);
    setShowNewForm((v) => !v);
  }

  function openEditForm(row: number) {
    setShowNewForm(false);
    setEditingRow((r) => (r === row ? null : row));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/ledger?project=${p.id}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              p.id === currentProjectId
                ? "border-[#002D56] bg-[#002D56] text-white"
                : "border-gray-200 text-gray-900 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-900">
          총 {entries.length}건{latestBalance !== null && ` · 현재 잔액 ${formatWon(latestBalance)}`}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            원본 시트 바로가기 ↗
          </a>
          <button
            onClick={openNewForm}
            className="rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C]"
          >
            {showNewForm ? "닫기" : "+ 새 항목"}
          </button>
        </div>
      </div>

      {showNewForm && (
        <EntryForm projectId={currentProjectId} onDone={() => setShowNewForm(false)} />
      )}
      {editingEntry && (
        <EntryForm
          projectId={currentProjectId}
          entry={editingEntry}
          onDone={() => setEditingRow(null)}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">날짜</th>
              <th className="px-3 py-2 font-medium">내용</th>
              <th className="px-3 py-2 font-medium">이름</th>
              <th className="px-3 py-2 font-medium">결제수단</th>
              <th className="px-3 py-2 text-right font-medium">수입</th>
              <th className="px-3 py-2 text-right font-medium">지출</th>
              <th className="px-3 py-2 text-right font-medium">잔액</th>
              <th className="px-3 py-2 font-medium">비고</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <tr key={entry.row} className={`text-gray-900 ${editingRow === entry.row ? "bg-blue-50" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                  {entry.date}
                  <span className="ml-1 text-gray-300">{entry.time}</span>
                </td>
                <td className="px-3 py-2">{entry.content}</td>
                <td className="whitespace-nowrap px-3 py-2">{entry.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{entry.method}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-emerald-600">
                  {formatWon(entry.income)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-red-600">
                  {formatWon(entry.expense)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {formatWon(entry.balance)}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{entry.note}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    onClick={() => openEditForm(entry.row)}
                    className="text-xs text-gray-500 hover:text-[#002D56] hover:underline"
                  >
                    {editingRow === entry.row ? "닫기" : "수정"}
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-xs text-gray-400">
                  기록 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntryForm({
  projectId,
  entry,
  onDone,
}: {
  projectId: string;
  entry?: LedgerEntry;
  onDone: () => void;
}) {
  const isEdit = !!entry;
  const [type, setType] = useState<"income" | "expense">(entry?.income != null ? "income" : "expense");
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const action = isEdit ? updateLedgerEntryAction : addLedgerEntryAction;
    const result = await action(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      {isEdit && <input type="hidden" name="row" value={entry.row} />}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          name="date"
          defaultValue={entry?.date || todayDateValue()}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
        <input
          type="time"
          name="time"
          defaultValue={entry?.time || nowTimeValue()}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
        <input
          name="name"
          placeholder="이름"
          defaultValue={entry?.name}
          required
          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
        <input
          name="method"
          list="ledger-payment-methods"
          placeholder="결제수단"
          defaultValue={entry?.method}
          required
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
        <datalist id="ledger-payment-methods">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>

      <input
        name="content"
        placeholder="내용"
        defaultValue={entry?.content}
        required
        autoFocus
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-300">
          <label
            className={`cursor-pointer px-3 py-2 text-sm ${
              type === "expense" ? "bg-red-600 text-white" : "bg-white text-gray-900"
            }`}
          >
            <input
              type="radio"
              name="type"
              value="expense"
              checked={type === "expense"}
              onChange={() => setType("expense")}
              className="hidden"
            />
            지출
          </label>
          <label
            className={`cursor-pointer px-3 py-2 text-sm ${
              type === "income" ? "bg-emerald-600 text-white" : "bg-white text-gray-900"
            }`}
          >
            <input
              type="radio"
              name="type"
              value="income"
              checked={type === "income"}
              onChange={() => setType("income")}
              className="hidden"
            />
            수입
          </label>
        </div>
        <input
          type="number"
          name="amount"
          placeholder="금액"
          defaultValue={entry ? (entry.expense ?? entry.income ?? undefined) : undefined}
          min={1}
          step={1}
          required
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          name="note"
          placeholder="비고 (선택)"
          defaultValue={entry?.note}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
        <input
          name="receipt"
          placeholder="영수증 (선택, 예: 항공권 영수증.pdf)"
          defaultValue={entry?.receipt}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#002D56] focus:ring-1 focus:ring-[#002D56]"
        />
      </div>

      {isEdit && (
        <p className="text-xs text-amber-600">
          수정하면 이 항목 이후의 모든 잔액이 새로 계산되어 시트에 다시 기록됩니다.
        </p>
      )}

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
          {pending ? (isEdit ? "수정 중..." : "기록 중...") : isEdit ? "수정" : "기록"}
        </button>
      </div>
    </form>
  );
}

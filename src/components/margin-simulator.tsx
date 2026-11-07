"use client";

import { useEffect, useState } from "react";
import {
  AUTO_VOUCHER,
  DEFAULT_ASSUMPTIONS,
  SKU_NAMES,
  parseAssumptions,
  type Assumptions,
  type SimInput,
} from "@/lib/margin-engine";
import SimTab from "@/components/margin-sim-tab";
import ScenarioTab from "@/components/margin-scenario-tab";
import AssumptionsTab from "@/components/margin-assumptions-tab";

// v2: 11.11 시트 기준 (AMS 삭제, 프로모션·바우처 교체). v1 저장값은 옛 프로모션이라 버리고 기본값으로 시작한다.
const STORAGE_KEY = "penefit-margin-assumptions-v2";

type Tab = "sim" | "list" | "assumptions";
const TABS: { id: Tab; label: string }[] = [
  { id: "sim", label: "시뮬레이터" },
  { id: "list", label: "시나리오 목록" },
  { id: "assumptions", label: "가정" },
];

const DEFAULT_INPUT: SimInput = {
  situation: "11.11 캠페인 (10/30-11/18)",
  voucher: AUTO_VOUCHER,
  qty: { "메인팩 1": 1, "3팩 번들": 0, "버라이어티 단품": 1, "컴플리트 세트": 1 },
};

function loadAssumptions(): Assumptions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = parseAssumptions(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    // 저장소 접근 불가·깨진 값이면 기본값
  }
  return structuredClone(DEFAULT_ASSUMPTIONS);
}

function saveAssumptions(A: Assumptions | null) {
  try {
    if (A) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(A));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장 실패해도 화면 계산은 계속
  }
}

function readUrl(): { tab: Tab; input: SimInput } {
  const p = new URLSearchParams(window.location.search);
  const tab = TABS.some((t) => t.id === p.get("tab")) ? (p.get("tab") as Tab) : "sim";
  const q = (p.get("q") ?? "").split(",").map(Number);
  // 수기 할인율 (?d=12.5 → 12.5%). 없으면 상황 할인율
  const d = Number(p.get("d"));
  const discountOk = p.has("d") && p.get("d") !== "" && Number.isFinite(d);
  // 컴플리트 세트 추가 전 링크(수량 3개)도 그대로 열린다
  const qtyOk = (q.length === SKU_NAMES.length || q.length === SKU_NAMES.length - 1) && q.every((n) => Number.isFinite(n));
  const input: SimInput = {
    situation: p.get("sit") ?? DEFAULT_INPUT.situation,
    voucher: p.get("v") ?? DEFAULT_INPUT.voucher,
    discount: discountOk ? Math.min(100, Math.max(0, d)) / 100 : null,
    qty: qtyOk
      ? (Object.fromEntries(SKU_NAMES.map((n, i) => [n, Math.min(20, Math.max(0, q[i] ?? 0))])) as SimInput["qty"])
      : DEFAULT_INPUT.qty,
  };
  return { tab, input };
}

export default function MarginSimulator() {
  // ssr: false 로더 뒤에서만 렌더되므로 window/localStorage를 초기값에 바로 쓴다.
  const [A, setA] = useState<Assumptions>(loadAssumptions);
  const [formKey, setFormKey] = useState(0);
  const [{ tab, input }, setView] = useState(readUrl);

  const setTab = (t: Tab) => setView((v) => ({ ...v, tab: t }));
  const setInput = (i: SimInput) => setView((v) => ({ ...v, input: i }));

  useEffect(() => {
    const p = new URLSearchParams();
    if (tab !== "sim") p.set("tab", tab);
    p.set("sit", input.situation);
    p.set("v", input.voucher);
    if (input.discount != null) p.set("d", String(Number((input.discount * 100).toPrecision(12))));
    p.set("q", SKU_NAMES.map((n) => input.qty[n] ?? 0).join(","));
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }, [tab, input]);

  const changeAssumptions = (next: Assumptions) => {
    setA(next);
    saveAssumptions(next);
  };

  // 기본값 복원·JSON 가져오기: 비제어 입력이라 폼 전체를 새 값으로 다시 그린다.
  const replaceAssumptions = (next: Assumptions | null) => {
    setA(next ?? structuredClone(DEFAULT_ASSUMPTIONS));
    saveAssumptions(next);
    setFormKey((k) => k + 1);
  };

  const isDefault = JSON.stringify(A) === JSON.stringify(DEFAULT_ASSUMPTIONS);

  return (
    <>
      <nav className="mb-4 flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-4 py-1.5 text-center text-sm transition-colors sm:flex-none ${
              t.id === tab ? "bg-[#0066cc] font-medium text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "sim" && <SimTab A={A} input={input} onChange={setInput} />}
      {tab === "list" && (
        <ScenarioTab
          A={A}
          onOpenInSim={(i) => {
            setView({ tab: "sim", input: i });
          }}
        />
      )}
      {tab === "assumptions" && (
        <AssumptionsTab
          key={formKey}
          A={A}
          isDefault={isDefault}
          onChange={changeAssumptions}
          onImport={replaceAssumptions}
          onReset={() => replaceAssumptions(null)}
        />
      )}
    </>
  );
}

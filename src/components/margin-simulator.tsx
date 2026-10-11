"use client";

import { useEffect, useState } from "react";
import {
  AMS_NAMES,
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

const STORAGE_KEY = "penefit-margin-assumptions-v1";

type Tab = "sim" | "list" | "assumptions";
const TABS: { id: Tab; label: string }[] = [
  { id: "sim", label: "시뮬레이터" },
  { id: "list", label: "시나리오 목록" },
  { id: "assumptions", label: "가정" },
];

// URL에선 AMS를 짧은 id로 쓴다 (?ams=none|open|target)
const AMS_IDS = ["none", "open", "target"] as const;

const DEFAULT_INPUT: SimInput = {
  situation: "10.10 (10/9-10/12)",
  voucher: AUTO_VOUCHER,
  ams: "AMS 타겟 20% (최악)",
  qty: { "메인팩 1": 1, "3팩 번들": 0, "버라이어티 단품": 1, "컴플리트 세트": 0 },
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
  const amsIdx = AMS_IDS.indexOf(p.get("ams") as (typeof AMS_IDS)[number]);
  const q = (p.get("q") ?? "").split(",").map(Number);
  // 컴플리트 세트 추가 전 링크(수량 3개)도 그대로 열린다
  const qtyOk = (q.length === SKU_NAMES.length || q.length === SKU_NAMES.length - 1) && q.every((n) => Number.isFinite(n));
  const input: SimInput = {
    situation: p.get("sit") ?? DEFAULT_INPUT.situation,
    voucher: p.get("v") ?? DEFAULT_INPUT.voucher,
    ams: amsIdx >= 0 ? AMS_NAMES[amsIdx] : DEFAULT_INPUT.ams,
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
    p.set("ams", AMS_IDS[Math.max(0, AMS_NAMES.indexOf(input.ams as (typeof AMS_NAMES)[number]))]);
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

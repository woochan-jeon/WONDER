"use client";

import { useMemo, useState } from "react";
import {
  AMS_NAMES,
  SKU_NAMES,
  findSituation,
  findSku,
  findVoucher,
  scenarioList,
  settleScenario,
  type Assumptions,
  type Grade,
  type ScenarioRow,
  type SimInput,
  type VoucherStatus,
} from "@/lib/margin-engine";
import ProfitCard from "@/components/margin-profit-card";
import { AMS_SHORT, voucherValueLabel } from "@/components/margin-sim-tab";
import { Card, GradeBadge, Hint, Segmented, fmtMoney, fmtPct } from "@/components/margin-ui";

type Col = {
  key: string;
  label: string;
  aux?: boolean;
  left?: boolean;
  value: (r: ScenarioRow, A: Assumptions) => number | string;
  render?: (r: ScenarioRow, A: Assumptions) => React.ReactNode;
};

const money = (n: number) => <span className={n < 0 ? "text-red-600" : ""}>{fmtMoney(n)}</span>;
const pct = (n: number) => <span className={n < 0 ? "text-red-600" : ""}>{fmtPct(n)}</span>;

const COLUMNS: Col[] = [
  { key: "situation", label: "상황", left: true, value: (r) => r.situation },
  { key: "sku", label: "SKU", left: true, value: (r) => r.sku },
  { key: "voucher", label: "바우처", left: true, value: (r) => r.voucher ?? "" },
  {
    key: "status",
    label: "바우처 적용",
    left: true,
    value: (r) => r.voucherStatus,
    render: (r) => (
      <span className={r.voucherStatus === "미달" ? "text-amber-700" : r.voucherStatus === "적용" ? "text-green-700" : "text-gray-400"}>
        {r.voucherStatus}
      </span>
    ),
  },
  { key: "spike", label: "스파이크데이", aux: true, value: (r, A) => (findSituation(A, r.situation)?.spike ? "Y" : "N") },
  { key: "feeRate", label: "수수료율", aux: true, value: (r) => r.feeRate, render: (r) => fmtPct(r.feeRate) },
  { key: "orderFixedCost", label: "주문 고정비", aux: true, value: (r) => r.orderFixedCost, render: (r) => fmtMoney(r.orderFixedCost) },
  {
    key: "vType",
    label: "유형",
    aux: true,
    value: (r, A) => {
      const v = findVoucher(A, r.voucher ?? "");
      return v ? (v.type === "rate" ? "정률" : "정액") : "";
    },
  },
  {
    key: "vValue",
    label: "할인값",
    aux: true,
    value: (r, A) => findVoucher(A, r.voucher ?? "")?.value ?? 0,
    render: (r, A) => {
      const v = findVoucher(A, r.voucher ?? "");
      return v ? voucherValueLabel(v) : "";
    },
  },
  { key: "vMin", label: "최소", aux: true, value: (r, A) => findVoucher(A, r.voucher ?? "")?.min ?? 0, render: (r, A) => fmtMoney(findVoucher(A, r.voucher ?? "")?.min ?? 0) },
  {
    key: "vCap",
    label: "캡",
    aux: true,
    value: (r, A) => findVoucher(A, r.voucher ?? "")?.cap ?? 0,
    render: (r, A) => {
      const cap = findVoucher(A, r.voucher ?? "")?.cap ?? 0;
      return cap === 0 ? "없음" : fmtMoney(cap);
    },
  },
  { key: "vRefund", label: "환급비율", aux: true, value: (r, A) => findVoucher(A, r.voucher ?? "")?.refund ?? 0, render: (r, A) => fmtPct(findVoucher(A, r.voucher ?? "")?.refund ?? 0) },
  { key: "listTotal", label: "상시가", value: (r) => r.listTotal, render: (r) => fmtMoney(r.listTotal) },
  { key: "discountRate", label: "상황 할인율", value: (r) => r.discountRate, render: (r) => fmtPct(r.discountRate) },
  { key: "discounted", label: "할인가", value: (r) => r.discounted, render: (r) => fmtMoney(r.discounted) },
  { key: "voucherDiscount", label: "바우처 할인", value: (r) => r.voucherDiscount, render: (r) => fmtMoney(r.voucherDiscount) },
  { key: "pay", label: "결제가", value: (r) => r.pay, render: (r) => fmtMoney(r.pay) },
  { key: "cumulativeDiscount", label: "누적 할인율", value: (r) => r.cumulativeDiscount, render: (r) => fmtPct(r.cumulativeDiscount) },
  { key: "margin", label: "마진", value: (r) => r.margin, render: (r) => money(r.margin) },
  { key: "marginRate", label: "마진율", value: (r) => r.marginRate, render: (r) => pct(r.marginRate) },
  { key: "grade", label: "등급", left: true, value: (r) => r.grade, render: (r) => <GradeBadge grade={r.grade} /> },
  { key: "marginAmsOpen", label: "AMS 18% 중첩 마진", value: (r) => r.marginAmsOpen, render: (r) => money(r.marginAmsOpen) },
  { key: "marginAmsTarget", label: "AMS 20% 중첩 마진", value: (r) => r.marginAmsTarget, render: (r) => money(r.marginAmsTarget) },
];

const STATUSES: VoucherStatus[] = ["적용", "미달", "-"];
const GRADES: Grade[] = ["여유", "보통", "주의", "위험", "역마진"];

type Filters = { sits: string[]; skus: string[]; vouchers: string[]; statuses: string[]; grades: string[] };
const EMPTY_FILTERS: Filters = { sits: [], skus: [], vouchers: [], statuses: [], grades: [] };

export default function ScenarioTab({ A, onOpenInSim }: { A: Assumptions; onOpenInSim: (input: SimInput) => void }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [showAux, setShowAux] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardAms, setCardAms] = useState<string>("AMS 타겟 20% (최악)");

  const all = useMemo(() => scenarioList(A), [A]);
  const rows = useMemo(() => {
    const pass = (sel: string[], v: string) => sel.length === 0 || sel.includes(v);
    const out = all.filter(
      (r) =>
        pass(filters.sits, r.situation) &&
        pass(filters.skus, r.sku) &&
        pass(filters.vouchers, r.voucher ?? "") &&
        pass(filters.statuses, r.voucherStatus) &&
        pass(filters.grades, r.grade),
    );
    if (sort) {
      const col = COLUMNS.find((c) => c.key === sort.key);
      if (col) {
        out.sort((a, b) => {
          const x = col.value(a, A);
          const y = col.value(b, A);
          const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ko");
          return d * sort.dir;
        });
      }
    }
    return out;
  }, [all, filters, sort, A]);

  const cols = COLUMNS.filter((c) => showAux || !c.aux);
  const selected = selectedId ? all.find((r) => r.id === selectedId) : undefined;
  const selSit = selected ? findSituation(A, selected.situation) : undefined;
  const selSku = selected ? findSku(A, selected.sku) : undefined;
  const cardResult = selected && selSit && selSku ? settleScenario(A, selSit, selSku, selected.voucher ?? "", cardAms) : null;

  const toggle = (k: keyof Filters, v: string) =>
    setFilters((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));
  const anyFilter = Object.values(filters).some((x) => x.length > 0);

  const onSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));

  return (
    <>
      <Hint>
        상황 × SKU × 바우처 조합을 수량 1, AMS 없음으로 계산한 목록입니다. AMS 18%/20% 중첩 마진은 별도 열. 행을 누르면 그 시나리오의 수익
        구조가 표시됩니다.
      </Hint>

      <Card className="mb-4 space-y-2">
        <ChipGroup label="상황" options={A.situations.map((s) => s.name)} selected={filters.sits} onToggle={(v) => toggle("sits", v)} />
        <ChipGroup label="SKU" options={[...SKU_NAMES]} selected={filters.skus} onToggle={(v) => toggle("skus", v)} />
        <ChipGroup label="바우처" options={A.vouchers.map((v) => v.name)} selected={filters.vouchers} onToggle={(v) => toggle("vouchers", v)} />
        <ChipGroup label="바우처 적용" options={STATUSES} selected={filters.statuses} onToggle={(v) => toggle("statuses", v)} />
        <ChipGroup label="등급" options={GRADES} selected={filters.grades} onToggle={(v) => toggle("grades", v)} />
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, statuses: ["적용"] }))}
            className="rounded-md bg-[#0066cc] px-3 py-1 text-xs font-medium text-white hover:bg-[#0058b0]"
          >
            적용만 보기
          </button>
          {anyFilter && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              필터 초기화
            </button>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-700">
            <input type="checkbox" checked={showAux} onChange={(e) => setShowAux(e.target.checked)} />
            보조 열 표시
          </label>
          <span className="text-xs text-gray-500">
            {rows.length} / {all.length}행
          </span>
        </div>
      </Card>

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <Card className="min-w-0 p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
              <thead className="sticky top-0 z-10 bg-white text-gray-500 shadow-[0_1px_0_#e5e7eb]">
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} className={`px-2 py-2 font-medium ${c.left ? "text-left" : ""}`}>
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className="inline-flex items-center gap-0.5 hover:text-gray-900"
                      >
                        {c.label}
                        <span className="w-2 text-[9px]">{sort?.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                    className={`cursor-pointer border-b border-gray-100 ${
                      r.id === selectedId ? "bg-[#0066cc]/10" : "hover:bg-gray-50"
                    }`}
                  >
                    {cols.map((c) => (
                      <td key={c.key} className={`px-2 py-1.5 ${c.left ? "text-left" : ""} text-gray-900`}>
                        {c.render ? c.render(r, A) : c.value(r, A)}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={cols.length} className="px-2 py-6 text-center text-gray-400">
                      조건에 맞는 시나리오가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selected && cardResult && selSit && (
          <>
            <div onClick={() => setSelectedId(null)} aria-hidden className="fixed inset-0 z-30 bg-black/30 lg:hidden" />
            <div className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-y-auto rounded-t-xl bg-[#f5f5f7] p-2 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
              <div className="lg:sticky lg:top-0">
                <div className="mb-1 flex justify-end lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="닫기"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200"
                  >
                    ✕
                  </button>
                </div>
                <ProfitCard
                  A={A}
                  result={cardResult}
                  spike={selSit.spike}
                  amsName={cardAms}
                  chip={`${selected.situation} · ${selected.sku} · ${selected.voucher}`}
                  payLabel="판매가"
                  controls={
                    <Segmented
                      size="sm"
                      value={cardAms}
                      onChange={setCardAms}
                      options={AMS_NAMES.map((n) => ({ value: n, label: `AMS ${AMS_SHORT[n]}` }))}
                    />
                  }
                  footer={
                    <button
                      type="button"
                      onClick={() =>
                        onOpenInSim({
                          situation: selected.situation,
                          voucher: selected.voucher ?? "",
                          ams: cardAms,
                          qty: { "메인팩 1": 0, "3팩 번들": 0, "버라이어티 단품": 0, [selected.sku]: 1 },
                        })
                      }
                      className="w-full rounded-md bg-[#0066cc] px-3 py-2 text-sm font-medium text-white hover:bg-[#0058b0]"
                    >
                      이 시나리오로 시뮬레이터 열기 →
                    </button>
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
      <p className="w-20 shrink-0 pt-1 text-xs font-medium text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o)}
              className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset transition-colors ${
                on ? "bg-[#0066cc] text-white ring-[#0066cc]" : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

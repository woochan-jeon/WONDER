"use client";

import { useState } from "react";
import {
  AMS_NAMES,
  AUTO_VOUCHER,
  COMPLETE_SKU,
  NO_VOUCHER,
  SKU_NAMES,
  findSituation,
  findVoucher,
  simulate,
  skuDiscount,
  type Assumptions,
  type Settlement,
  type SimInput,
  type SkuName,
  type Voucher,
} from "@/lib/margin-engine";
import ProfitCard from "@/components/margin-profit-card";
import { Card, GradeBadge, Hint, Segmented, fmtMoney, fmtPct, fmtSignedMoney } from "@/components/margin-ui";

export const AMS_SHORT: Record<string, string> = {
  "AMS 없음": "없음",
  "AMS 오픈 18% (최악)": "오픈 18%",
  "AMS 타겟 20% (최악)": "타겟 20%",
};

const SKU_SHORT: Record<SkuName, string> = {
  "메인팩 1": "메인팩 1",
  "3팩 번들": "3팩 번들",
  "버라이어티 단품": "버라이어티",
  "컴플리트 세트": "컴플리트",
};

type CardTarget = "combined" | SkuName;

export function voucherValueLabel(v: Voucher): string {
  return v.type === "rate" ? fmtPct(v.value) : fmtMoney(v.value);
}

export default function SimTab({
  A,
  input,
  onChange,
}: {
  A: Assumptions;
  input: SimInput;
  onChange: (next: SimInput) => void;
}) {
  const [cardTarget, setCardTarget] = useState<CardTarget>("combined");
  const sim = simulate(A, input);
  const sit = findSituation(A, input.situation) ?? A.situations[0];

  const rowFor = (t: CardTarget): Settlement => (t === "combined" ? sim.combined : sim.rows[SKU_NAMES.indexOf(t)]);
  // 고른 대상에 결제가가 없으면 한 주문, 그것도 없으면 (컴플리트 세트만 담은 경우) 컴플리트 세트
  const effectiveTarget: CardTarget =
    rowFor(cardTarget).pay > 0
      ? cardTarget
      : sim.combined.pay === 0 && rowFor(COMPLETE_SKU).pay > 0
        ? COMPLETE_SKU
        : "combined";
  const cardRow = rowFor(effectiveTarget);
  const cardAms = effectiveTarget === COMPLETE_SKU ? "AMS 없음" : input.ams;
  const campaignRows = sim.rows.filter((r) => r.sku !== COMPLETE_SKU);
  const completeRow = sim.rows.find((r) => r.sku === COMPLETE_SKU);

  const appliedVoucher = sim.combined.voucher ? findVoucher(A, sim.combined.voucher) : undefined;
  const highlightVoucher = input.voucher === AUTO_VOUCHER ? (sim.combined.voucher ?? NO_VOUCHER) : input.voucher;

  const setQty = (sku: SkuName, q: number) => onChange({ ...input, qty: { ...input.qty, [sku]: Math.min(20, Math.max(0, q)) } });

  return (
    <>
      <Hint>
        SKU별 행은 각각 따로 주문, 합계 행은 한 주문(함께 구매)으로 계산합니다. 컴플리트 세트는 캠페인 미진행(상시가·AMS 0%)이고
        샵 바우처 4종·신규·팔로우만 쓸 수 있으며 별도 주문으로만 계산합니다. 수수료는 바우처 적용 후 결제가 기준이며, 노란 칸에 해당하는
        왼쪽 입력값만 바꾸면 모든 표가 즉시 다시 계산됩니다.
      </Hint>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit space-y-4 lg:sticky lg:top-0">
          <Field label="상황">
            <select
              value={sit.name}
              onChange={(e) => onChange({ ...input, situation: e.target.value })}
              className="w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm"
            >
              {A.situations.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            {sit.note && <p className="mt-1 text-[11px] text-gray-500">{sit.note}</p>}
          </Field>
          <Field label="바우처">
            <select
              value={input.voucher}
              onChange={(e) => onChange({ ...input, voucher: e.target.value })}
              className="w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm"
            >
              <option value={AUTO_VOUCHER}>{AUTO_VOUCHER}</option>
              {A.vouchers.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
              {input.voucher !== AUTO_VOUCHER && !findVoucher(A, input.voucher) && (
                <option value={input.voucher}>{input.voucher} (삭제됨)</option>
              )}
            </select>
          </Field>
          <Field label="AMS">
            <Segmented
              size="sm"
              value={input.ams}
              onChange={(ams) => onChange({ ...input, ams })}
              options={AMS_NAMES.map((n) => ({ value: n, label: AMS_SHORT[n] }))}
            />
          </Field>
          <Field label="수량">
            <div className="space-y-2">
              {A.skus.map((sku) => {
                const q = input.qty[sku.name] ?? 0;
                return (
                  <div key={sku.name} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700">
                      {sku.name}
                      {skuDiscount(sit, sku.name) === null && <span className="ml-1 text-[11px] text-gray-400">진행 안 함</span>}
                      {sku.name === COMPLETE_SKU && <span className="ml-1 text-[11px] text-gray-400">별도 주문 · AMS 없음</span>}
                    </span>
                    <div className="flex items-center rounded-md border border-amber-300 bg-amber-50">
                      <button
                        type="button"
                        aria-label={`${sku.name} 수량 줄이기`}
                        onClick={() => setQty(sku.name, Math.ceil(q) - 1)}
                        className="h-8 w-8 text-gray-600 hover:bg-amber-100 disabled:opacity-30"
                        disabled={q <= 0}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step="any"
                        aria-label={`${sku.name} 수량`}
                        value={q}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          setQty(sku.name, Number.isFinite(n) ? n : 0);
                        }}
                        className="h-8 w-12 border-x border-amber-300 bg-white text-center text-sm tabular-nums"
                      />
                      <button
                        type="button"
                        aria-label={`${sku.name} 수량 늘리기`}
                        onClick={() => setQty(sku.name, Math.floor(q) + 1)}
                        className="h-8 w-8 text-gray-600 hover:bg-amber-100 disabled:opacity-30"
                        disabled={q >= 20}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>

          <dl className="space-y-1 border-t border-gray-100 pt-3 text-xs">
            <ReadOnly label="스파이크데이" value={sim.spike ? "Y" : "N"} />
            <ReadOnly label="적용 수수료율" value={fmtPct(sim.feeRate)} />
            <ReadOnly label="고비즈 물류지원" value={A.logistics.gobizOn ? `적용 (${fmtPct(A.logistics.gobizRate)})` : "미적용"} />
          </dl>

          <div className="border-t border-gray-100 pt-3">
            <p className="mb-1 text-xs font-medium text-gray-500">적용 바우처 (합계 행 기준)</p>
            {appliedVoucher ? (
              <>
                <p className="flex flex-wrap items-center gap-1 text-sm font-medium text-gray-900">
                  {sim.combined.voucherStatus === "미달" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">미달</span>
                  )}
                  {appliedVoucher.name}
                </p>
                <dl className="mt-1 space-y-0.5 text-xs">
                  <ReadOnly label="유형" value={appliedVoucher.type === "rate" ? "정률" : "정액"} />
                  <ReadOnly label="할인값" value={voucherValueLabel(appliedVoucher)} />
                  <ReadOnly label="최소 구매액" value={fmtMoney(appliedVoucher.min)} />
                  <ReadOnly label="캡" value={appliedVoucher.cap === 0 ? "없음" : fmtMoney(appliedVoucher.cap)} />
                  <ReadOnly label="쇼피 환급" value={fmtPct(appliedVoucher.refund)} />
                </dl>
              </>
            ) : (
              <p className="text-sm text-gray-500">{NO_VOUCHER}</p>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <ProfitCard
            A={A}
            result={cardRow}
            spike={sim.spike}
            amsName={cardAms}
            chip={`${sit.name} · ${effectiveTarget === "combined" ? "한 주문" : effectiveTarget} · ${AMS_SHORT[cardAms] === "없음" ? "AMS 없음" : `AMS ${AMS_SHORT[cardAms]}`}`}
            payLabel={effectiveTarget === "combined" ? "세트 판매가" : "판매가"}
            vsSeparate={effectiveTarget === "combined" ? sim.combined.vsSeparate : undefined}
            controls={
              <Segmented
                size="sm"
                value={effectiveTarget}
                onChange={setCardTarget}
                options={[
                  { value: "combined" as CardTarget, label: "한 주문" },
                  ...SKU_NAMES.map((n) => ({ value: n as CardTarget, label: SKU_SHORT[n], disabled: rowFor(n).pay === 0 })),
                ]}
              />
            }
          />

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">SKU별 · 함께 구매 마진</h2>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
                <thead className="text-gray-500">
                  <tr className="border-b border-gray-200">
                    {[
                      "SKU",
                      "수량",
                      "상시가 합계",
                      "상황 할인율",
                      "할인가 합계",
                      "적용 바우처",
                      "바우처 할인",
                      "쇼피 환급",
                      "결제가",
                      "누적 할인율",
                      "수수료",
                      "상품 비용",
                      "물류비",
                      "마진",
                      "마진율",
                      "등급",
                      "손익분기 결제가",
                      "최대 누적 할인율",
                    ].map((h, i) => (
                      <th key={h} className={`px-2 py-2 font-medium ${i === 0 || i === 5 ? "text-left" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.map((r) => (
                    <SimTableRow key={r.sku} label={r.sku} qty={r.qty} row={r} />
                  ))}
                  <SimTableRow label="합계 (한 주문, 컴플리트 제외)" qty={sim.combined.qty} row={sim.combined} bold />
                  {completeRow && <SimTableRow label={`${completeRow.sku} (별도 주문)`} qty={completeRow.qty} row={completeRow} />}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {campaignRows.map((r) => (
                <SimMobileCard key={r.sku} label={r.sku} qty={r.qty} row={r} />
              ))}
              <SimMobileCard label="합계 (한 주문, 컴플리트 제외)" qty={sim.combined.qty} row={sim.combined} bold />
              {completeRow && <SimMobileCard label={`${completeRow.sku} (별도 주문)`} qty={completeRow.qty} row={completeRow} />}
            </div>

            <p className="mt-3 text-sm">
              따로 주문 대비 마진 차이{" "}
              <span className={`font-semibold tabular-nums ${sim.combined.vsSeparate < 0 ? "text-red-600" : "text-green-600"}`}>
                {fmtSignedMoney(sim.combined.vsSeparate)}
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              함께 사면 Last Mile 1회, 버라이어티는 애드온가({fmtMoney(A.skus[2].addonPrice ?? 0)}), 바우처는 장바구니 금액 기준.
              컴플리트 세트는 별도 주문으로만 계산 (AMS 선택과 무관하게 AMS 0%).
            </p>
          </Card>

          <VoucherTable A={A} sim={sim} highlight={highlightVoucher} />
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      {children}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 tabular-nums">{value}</dd>
    </div>
  );
}

function VoucherCellLabel({ row }: { row: Settlement }) {
  if (!row.voucher) return <span className="text-gray-400">-</span>;
  if (row.voucherStatus === "미달" || row.voucherStatus === "적용 불가")
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-medium ${
            row.voucherStatus === "미달" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
          }`}
        >
          {row.voucherStatus}
        </span>
        <span className="text-gray-500">{row.voucher}</span>
      </span>
    );
  return <span>{row.voucher}</span>;
}

function SimTableRow({ label, qty, row, bold }: { label: string; qty: number; row: Settlement; bold?: boolean }) {
  const neg = row.margin < 0 ? "text-red-600" : "";
  return (
    <tr className={`border-b border-gray-100 ${bold ? "bg-gray-50 font-semibold" : ""}`}>
      <td className="px-2 py-2 text-left text-gray-900">{label}</td>
      <td className="px-2 py-2">{qty}</td>
      <td className="px-2 py-2">{fmtMoney(row.listTotal)}</td>
      <td className="px-2 py-2">{fmtPct(row.discountRate)}</td>
      <td className="px-2 py-2">{fmtMoney(row.discounted)}</td>
      <td className="px-2 py-2 text-left">
        <VoucherCellLabel row={row} />
      </td>
      <td className="px-2 py-2">{fmtMoney(row.voucherDiscount)}</td>
      <td className="px-2 py-2">{fmtMoney(row.refund)}</td>
      <td className="px-2 py-2 text-gray-900">{fmtMoney(row.pay)}</td>
      <td className="px-2 py-2">{fmtPct(row.cumulativeDiscount)}</td>
      <td className="px-2 py-2">{fmtMoney(row.fee)}</td>
      <td className="px-2 py-2">{fmtMoney(row.productCost)}</td>
      <td className="px-2 py-2">{fmtMoney(row.logistics)}</td>
      <td className={`px-2 py-2 ${neg}`}>{fmtMoney(row.margin)}</td>
      <td className={`px-2 py-2 ${neg}`}>{fmtPct(row.marginRate)}</td>
      <td className="px-2 py-2">
        <GradeBadge grade={row.grade} />
      </td>
      <td className="px-2 py-2">{fmtMoney(row.breakEvenPay)}</td>
      <td className="px-2 py-2">{fmtPct(row.maxCumulativeDiscount)}</td>
    </tr>
  );
}

function SimMobileCard({ label, qty, row, bold }: { label: string; qty: number; row: Settlement; bold?: boolean }) {
  const neg = row.margin < 0 ? "text-red-600" : "text-gray-900";
  const details: [string, React.ReactNode][] = [
    ["상시가 합계", fmtMoney(row.listTotal)],
    ["상황 할인율", fmtPct(row.discountRate)],
    ["할인가 합계", fmtMoney(row.discounted)],
    ["적용 바우처", <VoucherCellLabel key="v" row={row} />],
    ["바우처 할인", fmtMoney(row.voucherDiscount)],
    ["쇼피 환급", fmtMoney(row.refund)],
    ["누적 할인율", fmtPct(row.cumulativeDiscount)],
    ["수수료", fmtMoney(row.fee)],
    ["상품 비용", fmtMoney(row.productCost)],
    ["물류비", fmtMoney(row.logistics)],
    ["손익분기 결제가", fmtMoney(row.breakEvenPay)],
    ["최대 누적 할인율", fmtPct(row.maxCumulativeDiscount)],
  ];
  return (
    <div className={`rounded-md p-3 ring-1 ring-gray-200 ${bold ? "bg-gray-50" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm ${bold ? "font-semibold" : "font-medium"} text-gray-900`}>
          {label} <span className="font-normal text-gray-500">× {qty}</span>
        </p>
        <GradeBadge grade={row.grade} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 tabular-nums">
        <div>
          <p className="text-[11px] text-gray-500">결제가</p>
          <p className="text-base font-semibold text-gray-900">{fmtMoney(row.pay)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">마진</p>
          <p className={`text-base font-semibold ${neg}`}>{fmtMoney(row.margin)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500">마진율</p>
          <p className={`text-base font-semibold ${neg}`}>{fmtPct(row.marginRate)}</p>
        </div>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-[#0066cc]">자세히</summary>
        <dl className="mt-2 space-y-1 text-xs">
          {details.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-right tabular-nums text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function VoucherTable({ A, sim, highlight }: { A: Assumptions; sim: ReturnType<typeof simulate>; highlight: string }) {
  const cols = ["메인팩 1", "3팩 번들", "버라이어티 단품", "함께 구매", "컴플리트 세트"];
  const maxByCol = cols.map((_, i) => {
    let best = -Infinity;
    for (const r of sim.voucherTable) {
      const c = r.cells[i];
      if (typeof c === "number" && c > best) best = c;
    }
    return best;
  });
  return (
    <Card>
      <h2 className="text-sm font-semibold text-gray-900">바우처별 마진표</h2>
      <p className="mb-3 mt-0.5 text-xs text-gray-500">
        현재 상황·AMS·수량에서 각 바우처를 썼을 때의 마진. &quot;미달&quot;은 최소 구매액 미달, &quot;-&quot;는 결제가 없음, &quot;적용
        불가&quot;는 컴플리트 세트에 쓸 수 없는 바우처.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <thead className="text-gray-500">
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2 text-left font-medium">바우처</th>
              <th className="px-2 py-2 font-medium">최소</th>
              {cols.map((c) => (
                <th key={c} className="px-2 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sim.voucherTable.map((r) => {
              const selected = r.voucher === highlight;
              const v = A.vouchers.find((x) => x.name === r.voucher);
              return (
                <tr key={r.voucher} className={`border-b border-gray-100 ${selected ? "bg-[#0066cc]/10 font-medium" : ""}`}>
                  <td className="px-2 py-1.5 text-left text-gray-900">
                    {r.voucher}
                    {v && v.group !== "-" && <span className="ml-1 text-[10px] text-gray-400">{v.group}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500">{fmtMoney(r.min)}</td>
                  {r.cells.map((c, i) => (
                    <td key={i} className="px-2 py-1.5">
                      {typeof c === "number" ? (
                        <span className="inline-flex items-center gap-1">
                          {c === maxByCol[i] && (
                            <span className="rounded bg-green-100 px-1 text-[10px] font-medium text-green-700">최대</span>
                          )}
                          <span className={c < 0 ? "text-red-600" : "text-gray-900"}>{fmtMoney(c)}</span>
                        </span>
                      ) : (
                        <span className={c === "미달" ? "text-amber-700" : "text-gray-400"}>{c}</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

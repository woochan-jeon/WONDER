"use client";

import { useState } from "react";
import { baseFeeRate, type Assumptions, type Settlement } from "@/lib/margin-engine";
import { Card, GradeBadge, fmtMoney, fmtPct, fmtSignedMoney } from "@/components/margin-ui";

const COLORS = {
  margin: "#16a34a",
  platformFee: "#94a3b8",
  productCost: "#64748b",
  logistics: "#cbd5e1",
  rest: "#cbd5e1",
  voucher: "#8b5cf6",
  campaign: "#0ea5e9",
};

// 할인 세그먼트는 셀러가 받지 못한 금액이라 빗금으로 구분한다.
const stripes = (c: string) => `repeating-linear-gradient(45deg, ${c} 0 3px, ${c}59 3px 6px)`;

type SegKey = keyof typeof COLORS | "loss";
type Seg = { key: SegKey; label: string; value: number; color: string; detail: string; striped?: boolean };

// 상시가가 어디로 나가는지 보여주는 가로 누적 막대 카드.
// 네 세그먼트(마진·플랫폼 수수료·상품 원가·물류)의 합 = 결제가,
// 여기에 바우처 할인·할인(상황 또는 수기)을 더하면 = 상시가 합계.
export default function ProfitCard({
  A,
  result,
  spike,
  chip,
  payLabel,
  discountSource = "상황 할인",
  vsSeparate,
  controls,
  footer,
}: {
  A: Assumptions;
  result: Settlement;
  spike: boolean;
  chip: string;
  payLabel: string;
  discountSource?: string; // 할인 세그먼트 설명 ("상황 할인" | "수기 할인")
  vsSeparate?: number;
  controls?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [detailed, setDetailed] = useState(false);
  const [active, setActive] = useState<SegKey | null>(null);

  const { pay, margin, breakdown: bd, refund } = result;
  const loss = margin < 0;
  const pctOfPay = (v: number) => (pay === 0 ? 0 : v / pay);
  const marginColor = loss ? "text-red-600" : "text-green-600";

  const feeParts = [`기본 ${fmtPct(baseFeeRate(A))}`];
  if (spike) feeParts.push(`스파이크 ${fmtPct(A.fees.spikeDayExtra)}`);
  let feeDetail = feeParts.join(" + ");
  if (refund > 0) feeDetail += ` − 쇼피 환급 ${fmtMoney(refund)}`;

  const marginSeg: Seg = {
    key: "margin",
    label: "마진",
    value: bd.margin,
    color: COLORS.margin,
    detail: `마진 ${fmtMoney(bd.margin)} (${fmtPct(pctOfPay(bd.margin))})`,
  };
  const restValue = bd.platformFee + bd.productCost + bd.logistics;
  const restSegs: Seg[] = detailed
    ? [
        {
          key: "platformFee",
          label: "플랫폼 수수료",
          value: bd.platformFee,
          color: COLORS.platformFee,
          detail: `플랫폼 수수료 ${fmtMoney(bd.platformFee)} (${fmtPct(pctOfPay(bd.platformFee))}) — ${feeDetail}`,
        },
        {
          key: "productCost",
          label: "상품 원가",
          value: bd.productCost,
          color: COLORS.productCost,
          detail: `상품 원가 ${fmtMoney(bd.productCost)} (${fmtPct(pctOfPay(bd.productCost))}) — 제조원가 + 부대비`,
        },
        {
          key: "logistics",
          label: "물류",
          value: bd.logistics,
          color: COLORS.logistics,
          detail: `물류 ${fmtMoney(bd.logistics)} (${fmtPct(pctOfPay(bd.logistics))}) — Last Mile 순부담${
            A.logistics.gobizOn ? ` (고비즈 ${fmtPct(A.logistics.gobizRate)} 지원)` : " (고비즈 미적용)"
          }`,
        },
      ]
    : [
        {
          key: "rest",
          label: "원가·수수료·물류",
          value: restValue,
          color: COLORS.rest,
          detail: `원가·수수료·물류 ${fmtMoney(restValue)} (${fmtPct(pctOfPay(restValue))}) — 수수료 ${fmtMoney(
            bd.platformFee,
          )} · 원가 ${fmtMoney(bd.productCost)} · 물류 ${fmtMoney(bd.logistics)}`,
        },
      ];

  // 할인 세그먼트: 결제가 오른쪽에 붙여 상시가 합계까지 채운다 (% 는 상시가 대비).
  const { listTotal, voucherDiscount: voucherValue } = result;
  const campaignValue = listTotal - result.discounted;
  const pctOfList = (v: number) => (listTotal === 0 ? 0 : v / listTotal);
  const voucherSeg: Seg = {
    key: "voucher",
    label: "바우처 할인",
    value: voucherValue,
    color: COLORS.voucher,
    striped: true,
    detail: `바우처 할인 ${fmtMoney(voucherValue)} (상시가 대비 ${fmtPct(pctOfList(voucherValue))})${
      result.voucher && result.voucherStatus === "적용" ? ` — ${result.voucher}` : ""
    }${refund > 0 ? `, 이 중 쇼피 환급 ${fmtMoney(refund)}` : ""}`,
  };
  const campaignSeg: Seg = {
    key: "campaign",
    label: "할인",
    value: campaignValue,
    color: COLORS.campaign,
    striped: true,
    detail: `할인 ${fmtMoney(campaignValue)} (상시가 대비 ${fmtPct(pctOfList(campaignValue))}) — ${discountSource}${
      payLabel === "세트 판매가" && discountSource === "상황 할인" ? "·애드온가" : ""
    } 적용`,
  };
  const discountSegs = [voucherSeg, campaignSeg];
  const discountTotal = voucherValue + campaignValue;

  // 역마진이면 비용 합계가 결제가를 넘으므로, 결제가 위치에 마커를 두고 넘친 부분을 빗금으로 표시한다.
  const costEnd = loss ? pay - margin : pay;
  const barSegs = [...(loss ? [] : [marginSeg]), ...restSegs, ...discountSegs];
  const barTotal = costEnd + discountTotal;
  const payMarker = (loss || discountTotal > 0) && barTotal > 0 ? (pay / barTotal) * 100 : null;
  const lossDetail = `역마진 ${fmtMoney(margin)} — 비용이 결제가를 ${fmtMoney(-margin)} 초과`;
  const activeDetail =
    active === "loss" ? lossDetail : [marginSeg, ...restSegs, ...discountSegs].find((s) => s.key === active)?.detail;

  const segHandlers = (key: SegKey) => ({
    onMouseEnter: () => setActive(key),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(key),
    onBlur: () => setActive(null),
    onClick: () => setActive((cur) => (cur === key ? null : key)),
  });

  const legend = [marginSeg, ...restSegs];

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">현재 수익 구조</h2>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700" title={chip}>
            {chip}
          </span>
          <button
            type="button"
            onClick={() => setDetailed((d) => !d)}
            aria-pressed={detailed}
            className="shrink-0 rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            {detailed ? "간단히" : "자세히"}
          </button>
        </div>
      </div>

      {controls && <div className="mb-3">{controls}</div>}

      <div className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-100">
        <div className="grid grid-cols-3 gap-2">
          <Kpi label={payLabel} value={fmtMoney(pay)} />
          <Kpi
            label="총 비용"
            value={fmtMoney(result.totalCost)}
            title={`수수료 ${fmtMoney(bd.platformFee)} + 상품 원가 ${fmtMoney(bd.productCost)} + 물류 ${fmtMoney(bd.logistics)}${
              refund > 0 ? " (쇼피 환급 차감)" : ""
            }`}
          />
          <Kpi label="최종 예상 마진" value={fmtMoney(margin)} valueClass={pay === 0 ? "text-gray-900" : marginColor} />
        </div>

        {pay === 0 ? (
          <p className="mt-4 text-xs text-gray-500">결제가가 없습니다 (수량 0 또는 진행 안 함).</p>
        ) : (
          <>
            <div className="mt-4 flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-600">판매가 대비 마진율</span>
              <span className={`text-lg font-semibold tabular-nums ${marginColor}`}>{fmtPct(result.marginRate)}</span>
            </div>
            {/* 할인과 바우처를 나눠 보여준다 (상시가 대비). 누적 = 1 − 결제가 ÷ 상시가 */}
            <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs tabular-nums text-gray-600">
              <RateItem color={COLORS.campaign} label={discountSource === "수기 할인" ? "할인율 (수기)" : "할인율"} value={pctOfList(campaignValue)} />
              <RateItem color={COLORS.voucher} label="바우처" value={pctOfList(voucherValue)} />
              <span>
                누적 할인율 <span className="font-semibold text-gray-900">{fmtPct(result.cumulativeDiscount)}</span>
              </span>
            </div>

            <div className={`relative mt-2 ${payMarker !== null ? "pt-5" : ""}`}>
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-gray-200">
                {barSegs.map((s) =>
                  s.value > 0 ? (
                    <button
                      key={s.key}
                      type="button"
                      aria-label={s.detail}
                      title={s.detail}
                      {...segHandlers(s.key)}
                      className="h-full min-w-[2px] shrink transition-[width] duration-300 first:rounded-l-full last:rounded-r-full focus:outline-none"
                      style={{
                        width: `${(s.value / barTotal) * 100}%`,
                        ...(s.striped ? { backgroundImage: stripes(s.color) } : { backgroundColor: s.color }),
                      }}
                    />
                  ) : null,
                )}
              </div>
              {payMarker !== null && (
                <>
                  {loss && (
                    <button
                      type="button"
                      aria-label={lossDetail}
                      title={lossDetail}
                      {...segHandlers("loss")}
                      className={`absolute bottom-0 h-3 transition-[left,width] duration-300 focus:outline-none ${
                        discountTotal > 0 ? "" : "rounded-r-full"
                      }`}
                      style={{
                        left: `${payMarker}%`,
                        width: `${(-margin / barTotal) * 100}%`,
                        backgroundImage:
                          "repeating-linear-gradient(45deg, rgba(220,38,38,0.85) 0 3px, rgba(220,38,38,0.25) 3px 6px)",
                      }}
                    />
                  )}
                  <div
                    className="pointer-events-none absolute bottom-[-4px] top-3 border-l-2 border-dashed border-gray-900"
                    style={{ left: `${payMarker}%` }}
                  />
                  <span
                    className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-gray-900"
                    style={{ left: `${Math.min(Math.max(payMarker, 8), 92)}%` }}
                  >
                    결제가
                  </span>
                </>
              )}
            </div>

            <p className="mt-1.5 min-h-4 text-xs text-gray-600">{activeDetail}</p>

            {detailed ? (
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {legend.map((s) => (
                  <LegendItem key={s.key} seg={s} pct={pctOfPay(s.value)} red={s.key === "margin" && loss} />
                ))}
                {loss && (
                  <li className="flex items-center gap-1.5 text-xs text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden />
                    역마진 {fmtMoney(margin)}
                  </li>
                )}
              </ul>
            ) : (
              <ul className="mt-1 grid grid-cols-2 gap-2">
                <LegendItem seg={marginSeg} pct={pctOfPay(marginSeg.value)} red={loss} />
                <LegendItem seg={restSegs[0]} pct={pctOfPay(restSegs[0].value)} className="justify-end text-right" />
              </ul>
            )}

            <div className="mt-2 border-t border-gray-200 pt-2">
              <p className="mb-1 text-[11px] text-gray-500">
                상시가 {fmtMoney(listTotal)} = 결제가 {fmtMoney(pay)} + 할인 {fmtMoney(campaignValue)} + 바우처 할인{" "}
                {fmtMoney(voucherValue)}
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {discountSegs.map((s) => (
                  <LegendItem key={s.key} seg={s} pct={pctOfList(s.value)} amount suffix="상시가 대비" />
                ))}
              </ul>
            </div>

            {refund > 0 && (
              <p className="mt-2 text-[11px] text-gray-500">쇼피 환급 {fmtMoney(refund)}은 수수료에서 차감해 표시</p>
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          등급 <GradeBadge grade={result.grade} />
        </span>
        <span aria-hidden>·</span>
        <span>손익분기 결제가 {fmtMoney(result.breakEvenPay)}</span>
        <span aria-hidden>·</span>
        <span>최대 누적 할인율 {fmtPct(result.maxCumulativeDiscount)}</span>
        {vsSeparate !== undefined && (
          <>
            <span aria-hidden>·</span>
            <span className={vsSeparate < 0 ? "text-red-600" : ""}>따로 주문 대비 {fmtSignedMoney(vsSeparate)}</span>
          </>
        )}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </Card>
  );
}

function Kpi({
  label,
  value,
  valueClass = "text-gray-900",
  title,
}: {
  label: string;
  value: string;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <p className="truncate text-xs text-gray-500">{label}</p>
      <p className={`truncate text-base font-semibold tabular-nums sm:text-xl ${valueClass}`}>{value}</p>
    </div>
  );
}

function RateItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundImage: stripes(color) }} aria-hidden />
      {label} <span className="font-semibold text-gray-900">{fmtPct(value)}</span>
    </span>
  );
}

function LegendItem({
  seg,
  pct,
  red,
  amount,
  suffix,
  className = "",
}: {
  seg: Seg;
  pct: number;
  red?: boolean;
  amount?: boolean;
  suffix?: string;
  className?: string;
}) {
  return (
    <li className={`flex min-w-0 items-center gap-1.5 text-xs ${red ? "text-red-600" : "text-gray-700"} ${className}`}>
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={seg.striped ? { backgroundImage: stripes(seg.color) } : { backgroundColor: seg.color }}
        aria-hidden
      />
      <span className="truncate">{seg.label}</span>
      {amount && <span className="shrink-0 tabular-nums">{fmtMoney(seg.value)}</span>}
      <span className={`shrink-0 tabular-nums ${amount ? "text-gray-500" : ""}`}>
        {amount ? "(" : ""}
        {suffix ? `${suffix} ` : ""}
        {fmtPct(pct)}
        {amount ? ")" : ""}
      </span>
    </li>
  );
}

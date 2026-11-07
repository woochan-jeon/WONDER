// PENEFIT 쇼피SG 프로모션 마진 엔진.
// Ported from the 「PENEFIT 쇼피SG 프로모션 마진」 Google Sheet (시뮬레이터·시나리오 목록·가정 탭).
// Don't change the math here without re-running scripts/verify-margin-engine.mjs.
//
// Kept free of path aliases and non-erasable TS syntax so Node can run it
// directly (type stripping) from the verification script.

export const SKU_NAMES = ["메인팩 1", "3팩 번들", "버라이어티 단품", "컴플리트 세트"] as const;
export type SkuName = (typeof SKU_NAMES)[number];
// 상황 할인·함께 구매가 적용되는 SKU. 컴플리트 세트는 캠페인 미진행:
// 항상 상시가, 별도 주문, 「컴플리트 적용」 바우처만 사용.
export const CAMPAIGN_SKUS = ["메인팩 1", "3팩 번들", "버라이어티 단품"] as const;
export type CampaignSkuName = (typeof CAMPAIGN_SKUS)[number];
export const COMPLETE_SKU = "컴플리트 세트";

export const SITUATION_VOUCHER_GROUPS = ["샵", "라이브", "11.11", "없음"] as const;
export const VOUCHER_GROUPS = ["-", "샵", "라이브", "11.11"] as const;
// 바우처 적용 SKU: 전체 또는 특정 SKU 전용 (그 SKU 단독 주문에만 적용, 함께 구매엔 적용 안 함)
export const ALL_SKUS = "전체";

export const NO_VOUCHER = "바우처 없음";
export const AUTO_VOUCHER = "자동 (최대 할인)";

export type Sku = {
  name: SkuName;
  listPrice: number;
  costKrw: number;
  overheadUnits: number;
  addonPrice: number | null;
  note?: string;
};

export type Situation = {
  name: string;
  // null = 진행 안 함
  discount: Record<CampaignSkuName, number | null>;
  spike: boolean;
  voucherGroup: string;
  note?: string;
};

export type Voucher = {
  name: string;
  group: string;
  type: "rate" | "fixed";
  value: number;
  min: number;
  cap: number; // 0 = 상한 없음
  refund: number;
  auto: boolean;
  complete: boolean; // 컴플리트 세트에 적용 가능
  sku: string; // ALL_SKUS | SkuName
  note?: string;
};

export type Assumptions = {
  fees: { shopee: number; pg: number; payoneer: number; spikeDayExtra: number };
  logistics: {
    lastMile: number;
    gobizRate: number;
    gobizOn: boolean;
    perUnitOverhead: number;
    fxKrwPerSgd: number;
  };
  skus: Sku[];
  situations: Situation[];
  vouchers: Voucher[];
  grade: { relaxed: number; normal: number; caution: number };
};

export type Grade = "-" | "역마진" | "여유" | "보통" | "주의" | "위험";
export type VoucherStatus = "-" | "적용" | "미달" | "적용 불가" | "대상 아님";

// ===== 가정 (Assumptions) — 시트 「가정」 탭, 2026-11-07 기준 =====
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  fees: { shopee: 0.11, pg: 0.03, payoneer: 0.009, spikeDayExtra: 0.01 },
  logistics: { lastMile: 2.03, gobizRate: 0.7, gobizOn: true, perUnitOverhead: 2.268881654, fxKrwPerSgd: 1104 },
  skus: [
    { name: "메인팩 1", listPrice: 27.8, costKrw: 3572, overheadUnits: 1, addonPrice: null, note: "6색 평균 원가" },
    { name: "3팩 번들", listPrice: 74.8, costKrw: 10631.4, overheadUnits: 3, addonPrice: null, note: "번들 5종 평균 원가" },
    {
      name: "버라이어티 단품",
      listPrice: 12.8,
      costKrw: 1400,
      overheadUnits: 1,
      addonPrice: 9.8,
      note: "메인팩과 함께 사면 애드온가 적용 (3팩 번들은 애드온 딜에서 꺼져 있음)",
    },
    {
      name: "컴플리트 세트",
      listPrice: 138.8,
      costKrw: 21432,
      overheadUnits: 6,
      addonPrice: null,
      note: "6색 전종. 캠페인 미진행, 샵 바우처 4종·신규·팔로우·재구매만 적용",
    },
  ],
  situations: [
    {
      name: "평시",
      discount: { "메인팩 1": 0, "3팩 번들": 0, "버라이어티 단품": 0 },
      spike: false,
      voucherGroup: "샵",
      note: "상시가 판매 (11.11 캠페인 종료 후 기준)",
    },
    {
      name: "라이브 (11/7·11/8)",
      discount: { "메인팩 1": 0.22, "3팩 번들": 0.35, "버라이어티 단품": 0.2 },
      spike: false,
      voucherGroup: "라이브",
      note: "스트리밍가: 메인 S$21.68, 3팩 S$48.62, 버라이어티 S$10.24",
    },
    {
      name: "샵 플래시딜 10%",
      discount: { "메인팩 1": 0.1, "3팩 번들": 0.1, "버라이어티 단품": null },
      spike: false,
      voucherGroup: "11.11",
      note: "메인 S$25.02, 3팩 S$67.32. 11.11 캠페인 바우처 중첩 가능",
    },
    {
      name: "샵 플래시딜 15%",
      discount: { "메인팩 1": 0.15, "3팩 번들": 0.15, "버라이어티 단품": null },
      spike: false,
      voucherGroup: "11.11",
      note: "메인 S$23.63, 3팩 S$63.58. 11/15 슬롯은 스파이크데이를 Y로 바꿔 확인",
    },
    {
      name: "샵 플래시딜 18%",
      discount: { "메인팩 1": 0.18, "3팩 번들": 0.18, "버라이어티 단품": null },
      spike: false,
      voucherGroup: "11.11",
      note: "메인 S$22.79 (11/11·11/12 01-03시), 3팩 S$61.33 (11/15 01-03시). 11/11·11/15 슬롯은 스파이크데이를 Y로 바꿔 확인",
    },
    {
      name: "11.11 캠페인 (10/30-11/18)",
      discount: { "메인팩 1": 0, "3팩 번들": 0, "버라이어티 단품": 0 },
      spike: false,
      voucherGroup: "11.11",
      note: "바우처 캠페인, 상품가는 상시가",
    },
    {
      name: "11.11 당일",
      discount: { "메인팩 1": 0, "3팩 번들": 0, "버라이어티 단품": 0 },
      spike: true,
      voucherGroup: "11.11",
      note: "11.11 스파이크데이, 상품가는 상시가",
    },
  ],
  vouchers: [
    { name: "바우처 없음", group: "-", type: "fixed", value: 0, min: 0, cap: 0, refund: 0, auto: false, complete: false, sku: ALL_SKUS },
    { name: "샵 15% (S$15↑)", group: "샵", type: "rate", value: 0.15, min: 15, cap: 0, refund: 0, auto: true, complete: true, sku: ALL_SKUS, note: "PENET15, 12/27까지" },
    { name: "샵 23% (S$50↑)", group: "샵", type: "rate", value: 0.23, min: 50, cap: 0, refund: 0, auto: true, complete: true, sku: ALL_SKUS, note: "PENET23, 12/27까지" },
    { name: "샵 25% (S$60↑)", group: "샵", type: "rate", value: 0.25, min: 60, cap: 0, refund: 0, auto: true, complete: true, sku: ALL_SKUS, note: "PENET25, 12/27까지" },
    { name: "샵 30% (S$80↑, 캡 S$40)", group: "샵", type: "rate", value: 0.3, min: 80, cap: 40, refund: 0, auto: true, complete: true, sku: ALL_SKUS, note: "PENET30, 12/27까지" },
    { name: "팔로우 S$1 (S$10↑)", group: "샵", type: "fixed", value: 1, min: 10, cap: 0, refund: 0, auto: false, complete: true, sku: ALL_SKUS, note: "팔로우 시 지급, 1/3까지" },
    { name: "신규 구매자 S$2 (S$20↑)", group: "샵", type: "fixed", value: 2, min: 20, cap: 0, refund: 0, auto: false, complete: true, sku: ALL_SKUS, note: "PENENEW, 12/27까지" },
    { name: "재구매자 S$1 (S$15↑)", group: "샵", type: "fixed", value: 1, min: 15, cap: 0, refund: 0, auto: false, complete: true, sku: ALL_SKUS, note: "PENEBACK, 12/27까지" },
    { name: "라이브 메인팩 30% (S$14↑, 캡 S$7)", group: "라이브", type: "rate", value: 0.3, min: 14, cap: 7, refund: 0, auto: true, complete: false, sku: "메인팩 1", note: "11/3-11/11" },
    { name: "라이브 3팩 30% (S$60↑, 캡 S$25)", group: "라이브", type: "rate", value: 0.3, min: 60, cap: 25, refund: 0, auto: true, complete: false, sku: "3팩 번들", note: "11/3-11/11" },
    { name: "라이브 버라이어티 S$2 (S$9↑)", group: "라이브", type: "fixed", value: 2, min: 9, cap: 0, refund: 0, auto: true, complete: false, sku: "버라이어티 단품", note: "11/3-11/11" },
    { name: "11.11 Co-Share 20% (S$15↑, 캡 S$5)", group: "11.11", type: "rate", value: 0.2, min: 15, cap: 5, refund: 0.2, auto: true, complete: false, sku: ALL_SKUS, note: "10/30-11/18. 환급률 1/5는 크로스보더 적용 여부 미확정" },
  ],
  grade: { relaxed: 2.0, normal: 1.6, caution: 1.3 },
};

// ===== 파생값 =====
export const baseFeeRate = (A: Assumptions) => A.fees.shopee + A.fees.pg + A.fees.payoneer;
export const lastMileNet = (A: Assumptions) =>
  A.logistics.lastMile * (1 - (A.logistics.gobizOn ? A.logistics.gobizRate : 0));
// 물류 제외 상품비용(개당)
export const unitCost = (A: Assumptions, sku: Sku) =>
  sku.costKrw / A.logistics.fxKrwPerSgd + A.logistics.perUnitOverhead * sku.overheadUnits;
export const feeRate = (A: Assumptions, sit: Situation) => baseFeeRate(A) + (sit.spike ? A.fees.spikeDayExtra : 0);
// 바우처를 이 주문에 쓸 수 있는 SKU인가. sku = null 은 함께 구매(여러 SKU 한 주문): 전체 바우처만
export const voucherFitsSku = (v: Voucher, sku: SkuName | null) => v.sku === ALL_SKUS || v.sku === sku;

export const findVoucher = (A: Assumptions, n: string) => A.vouchers.find((v) => v.name === n);
export const findSituation = (A: Assumptions, n: string) => A.situations.find((s) => s.name === n);
export const findSku = (A: Assumptions, n: string) => A.skus.find((s) => s.name === n);

export function voucherDiscount(v: Voucher | null | undefined, amount: number): number {
  if (!v || amount <= 0) return 0;
  if (v.type === "rate") return Math.min(amount * v.value, v.cap === 0 ? amount : v.cap);
  return v.value;
}

// 자동(최대 할인) 바우처 선택: 시뮬레이터 F열 로직
// 컴플리트 세트는 상황 구분과 무관하게 「컴플리트 적용」 바우처 중에서 고른다 (F15).
// SKU 전용 바우처(라이브)는 그 SKU 단독 주문에서만 후보가 된다.
export function autoVoucher(A: Assumptions, sit: Situation, amount: number, sku: SkuName | null): Voucher | null {
  const complete = sku === COMPLETE_SKU;
  let best: Voucher | null = null;
  let bestD = 0;
  for (const v of A.vouchers) {
    const groupOk = complete
      ? v.complete
      : (v.group === "샵" && sit.voucherGroup !== "없음") || v.group === sit.voucherGroup;
    if (!v.auto || amount <= 0 || amount < v.min || !groupOk || !voucherFitsSku(v, sku)) continue;
    const d = voucherDiscount(v, amount);
    // 동률이면 목록상 먼저 나온 것 (MATCH 동작)
    if (d > bestD) {
      bestD = d;
      best = v;
    }
  }
  return best; // null = 바우처 없음
}

export function grade(A: Assumptions, pay: number, totalCost: number, margin: number): Grade {
  if (pay === 0) return "-";
  if (margin < 0) return "역마진";
  const r = pay / totalCost;
  if (r >= A.grade.relaxed) return "여유";
  if (r >= A.grade.normal) return "보통";
  if (r >= A.grade.caution) return "주의";
  return "위험";
}

export type Breakdown = {
  platformFee: number; // 기본+스파이크 수수료에서 쇼피 환급 차감
  productCost: number;
  logistics: number;
  margin: number;
};

export type Settlement = {
  listTotal: number;
  discountRate: number;
  discounted: number;
  voucher: string | null;
  voucherStatus: VoucherStatus;
  voucherDiscount: number;
  refund: number;
  pay: number;
  cumulativeDiscount: number;
  feeRate: number;
  fee: number;
  productCost: number;
  logistics: number;
  totalCost: number; // 수수료 + 상품 비용 + 물류비 − 쇼피 환급 = 결제가 − 마진
  margin: number;
  marginRate: number;
  grade: Grade;
  breakEvenPay: number;
  maxCumulativeDiscount: number;
  breakdown: Breakdown;
};

type SettleInput = {
  listTotal: number;
  discounted: number; // 할인가 합계
  productCost: number; // 상품비용 합계
  logistics: number; // 물류비
  sit: Situation;
  voucherSel: string;
  sku: SkuName | null; // null = 함께 구매 (한 주문)
};

// 한 줄(주문) 계산
function settle(A: Assumptions, { listTotal, discounted, productCost, logistics, sit, voucherSel, sku }: SettleInput): Settlement {
  const complete = sku === COMPLETE_SKU;
  const rate = feeRate(A, sit);
  let voucher: Voucher | null = null;
  let status: VoucherStatus = "-";
  if (discounted > 0) {
    const chosen = voucherSel === AUTO_VOUCHER ? autoVoucher(A, sit, discounted, sku) : findVoucher(A, voucherSel);
    if (chosen && chosen.name !== NO_VOUCHER) {
      status =
        complete && !chosen.complete
          ? "적용 불가"
          : !voucherFitsSku(chosen, sku)
            ? "대상 아님"
            : discounted < chosen.min
              ? "미달"
              : "적용";
      voucher = chosen;
    }
  }
  const vDisc = status === "적용" ? voucherDiscount(voucher, discounted) : 0;
  const refund = vDisc * (voucher?.refund ?? 0);
  const pay = discounted - vDisc;
  const fee = pay * rate;
  const margin = pay - fee - productCost - logistics + refund;
  const breakEven = pay === 0 ? 0 : (productCost + logistics) / (1 - rate);
  const totalCost = fee + productCost + logistics - refund;
  return {
    listTotal,
    discountRate: listTotal === 0 ? 0 : 1 - discounted / listTotal,
    discounted,
    voucher: voucher?.name ?? null,
    voucherStatus: status,
    voucherDiscount: vDisc,
    refund,
    pay,
    cumulativeDiscount: listTotal === 0 ? 0 : 1 - pay / listTotal,
    feeRate: rate,
    fee,
    productCost,
    logistics,
    totalCost,
    margin,
    marginRate: pay === 0 ? 0 : margin / pay,
    grade: grade(A, pay, totalCost, margin),
    breakEvenPay: breakEven,
    maxCumulativeDiscount: listTotal === 0 ? 0 : 1 - breakEven / listTotal,
    breakdown: {
      platformFee: fee - refund,
      productCost,
      logistics,
      margin,
    },
  };
}

// ===== 시뮬레이터 =====
export type SimInput = {
  situation: string;
  voucher: string; // AUTO_VOUCHER | 바우처명
  // 수기 할인율 (상시가 대비, 0~1). 넣으면 상황 할인율 대신 모든 SKU에 같은 할인율을 쓴다. null/생략 = 상황 할인율
  discount?: number | null;
  qty: Record<SkuName, number>;
};

export type SimRow = Settlement & { sku: SkuName; qty: number };
export type SimCombined = Settlement & { qty: number; vsSeparate: number };
export type VoucherCell = number | "-" | "미달" | "적용 불가" | "대상 아님";
export type VoucherTableRow = { voucher: string; min: number; cells: VoucherCell[] };

export type SimResult = {
  feeRate: number;
  spike: boolean;
  rows: SimRow[];
  combined: SimCombined;
  voucherTable: VoucherTableRow[];
};

// 상황 할인율. 컴플리트 세트는 캠페인 미진행이라 항상 0 (상시가)
export const skuDiscount = (sit: Situation, sku: SkuName): number | null =>
  sku === COMPLETE_SKU ? 0 : sit.discount[sku];

export function simulate(A: Assumptions, input: SimInput): SimResult {
  const sit = findSituation(A, input.situation) ?? A.situations[0];
  const lm = lastMileNet(A);
  const manual = input.discount ?? null;
  const rows: SimRow[] = A.skus.map((sku) => {
    const q = input.qty[sku.name] ?? 0;
    const d = manual ?? skuDiscount(sit, sku.name);
    const listTotal = d === null ? 0 : sku.listPrice * q;
    const discounted = d === null ? 0 : listTotal * (1 - d);
    return {
      sku: sku.name,
      qty: q,
      ...settle(A, {
        listTotal,
        discounted,
        sit,
        voucherSel: input.voucher,
        productCost: discounted === 0 ? 0 : unitCost(A, sku) * q,
        logistics: discounted === 0 ? 0 : lm,
        sku: sku.name,
      }),
    };
  });
  // 함께 구매(한 주문): 메인팩이 있으면 버라이어티는 애드온가 (3팩 번들은 애드온 딜에서 빠짐).
  // 수기 할인율이면 애드온가 대신 그 할인율을 그대로 쓴다. 컴플리트 세트는 별도 주문이라 제외
  const [m, b, v, c] = rows;
  const vs = findSku(A, "버라이어티 단품");
  const vDiscounted = v.listTotal === 0 ? 0 : m.qty > 0 && manual === null ? (vs?.addonPrice ?? 0) * v.qty : v.discounted;
  const discounted = m.discounted + b.discounted + vDiscounted;
  const combinedBase = {
    qty: m.qty + b.qty + v.qty,
    ...settle(A, {
      listTotal: m.listTotal + b.listTotal + v.listTotal,
      discounted,
      sit,
      voucherSel: input.voucher,
      productCost: m.productCost + b.productCost + v.productCost,
      logistics: discounted === 0 ? 0 : lm,
      sku: null,
    }),
  };
  const combined: SimCombined = {
    ...combinedBase,
    vsSeparate: combinedBase.margin - (m.margin + b.margin + v.margin),
  };
  // 바우처별 마진 표: 메인팩·번들·버라이어티·함께 구매·컴플리트 세트
  const voucherTable = A.vouchers.map((vo) => {
    const cell = (r: Settlement, sku: SkuName | null): VoucherCell => {
      if (r.discounted === 0) return "-";
      if (!voucherFitsSku(vo, sku)) return "대상 아님";
      if (r.discounted < vo.min) return "미달";
      const vd = voucherDiscount(vo, r.discounted);
      return (r.discounted - vd) * (1 - r.feeRate) - r.productCost - r.logistics + vd * vo.refund;
    };
    // 시트는 바우처 없음도 '적용 불가'로 두지만, 바우처 없이 사는 경우의 마진을 보여준다
    const completeCell: VoucherCell =
      c.discounted > 0 && vo.name !== NO_VOUCHER && !vo.complete ? "적용 불가" : cell(c, COMPLETE_SKU);
    return {
      voucher: vo.name,
      min: vo.min,
      cells: [cell(m, m.sku), cell(b, b.sku), cell(v, v.sku), cell(combined, null), completeCell],
    };
  });
  return { feeRate: feeRate(A, sit), spike: sit.spike, rows, combined, voucherTable };
}

// ===== 시나리오 목록 =====
export type ScenarioRow = Settlement & {
  id: string;
  situation: string;
  sku: SkuName;
  orderFixedCost: number;
};

// 시나리오 한 줄 (수량 1)
export function settleScenario(A: Assumptions, sit: Situation, sku: Sku, voucherName: string): Settlement {
  const d = skuDiscount(sit, sku.name) ?? 0;
  const listTotal = sku.listPrice;
  const discounted = listTotal * (1 - d);
  return settle(A, {
    listTotal,
    discounted,
    productCost: unitCost(A, sku),
    logistics: lastMileNet(A),
    sit,
    voucherSel: voucherName,
    sku: sku.name,
  });
}

// 상황·SKU별로 나열할 바우처: 바우처 없음 + 그 상황 구분의 바우처 + (샵 외 캠페인이면) 자동 선택에 들어가는 샵 바우처.
// SKU 전용 바우처는 그 SKU에만. 컴플리트 세트는 「컴플리트 적용」 바우처.
function scenarioVouchers(A: Assumptions, sit: Situation, sku: SkuName): Voucher[] {
  if (sku === COMPLETE_SKU) return A.vouchers.filter((v) => v.name === NO_VOUCHER || v.complete);
  const fits = A.vouchers.filter((v) => voucherFitsSku(v, sku));
  const own = fits.filter((v) => v.name !== NO_VOUCHER && v.group === sit.voucherGroup);
  const shop = sit.voucherGroup === "샵" || sit.voucherGroup === "없음" ? [] : fits.filter((v) => v.group === "샵" && v.auto);
  return [...fits.filter((v) => v.name === NO_VOUCHER), ...own, ...shop];
}

export function scenarioList(A: Assumptions): ScenarioRow[] {
  const out: ScenarioRow[] = [];
  const lm = lastMileNet(A);
  const push = (sit: Situation, sku: Sku) => {
    for (const vo of scenarioVouchers(A, sit, sku.name)) {
      const base = settleScenario(A, sit, sku, vo.name);
      out.push({
        ...base,
        id: `${sit.name}|${sku.name}|${vo.name}`,
        situation: sit.name,
        sku: sku.name,
        voucher: vo.name,
        voucherStatus: vo.name === NO_VOUCHER ? "-" : base.voucherStatus,
        orderFixedCost: unitCost(A, sku) + lm,
      });
    }
  };
  for (const sit of A.situations)
    for (const sku of A.skus) {
      if (sku.name === COMPLETE_SKU || skuDiscount(sit, sku.name) === null) continue;
      push(sit, sku);
    }
  // 컴플리트 세트는 상황 할인이 없어 스파이크데이 여부만 마진을 바꾼다: 스파이크 N·Y 첫 상황씩 (시트: 평시·11.11 당일)
  const complete = findSku(A, COMPLETE_SKU);
  if (complete)
    for (const spike of [false, true]) {
      const sit = A.situations.find((x) => x.spike === spike);
      if (sit) push(sit, complete);
    }
  return out;
}

// ===== 저장값 검증 =====
// JSON 가져오기에서 읽은 값이 엔진이 기대하는 모양인지 확인한다.
// SKU 이름은 화면에서 바꿀 수 없으므로 기본값과 같아야 한다.
// 예전 형식(SKU 3개, 바우처에 complete·sku 없음, AMS 포함)도 기본값으로 채워 읽는다.
export function parseAssumptions(raw: unknown): Assumptions | null {
  const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
  if (!isObj(raw)) return null;
  if (Array.isArray(raw.skus) && raw.skus.length === CAMPAIGN_SKUS.length) {
    raw.skus = [...raw.skus, structuredClone(DEFAULT_ASSUMPTIONS.skus[SKU_NAMES.indexOf(COMPLETE_SKU)])];
  }
  if (Array.isArray(raw.vouchers)) {
    for (const v of raw.vouchers) {
      if (!isObj(v)) continue;
      if (v.complete === undefined) v.complete = findVoucher(DEFAULT_ASSUMPTIONS, String(v.name))?.complete ?? false;
      if (v.sku === undefined) v.sku = ALL_SKUS;
    }
  }
  delete raw.ams; // AMS는 시트에서 빠졌다
  const { fees, logistics, skus, situations, vouchers, grade: g } = raw;
  if (!isObj(fees) || !["shopee", "pg", "payoneer", "spikeDayExtra"].every((k) => isNum(fees[k]))) return null;
  if (
    !isObj(logistics) ||
    !["lastMile", "gobizRate", "perUnitOverhead", "fxKrwPerSgd"].every((k) => isNum(logistics[k])) ||
    typeof logistics.gobizOn !== "boolean" ||
    logistics.fxKrwPerSgd === 0
  )
    return null;
  if (
    !Array.isArray(skus) ||
    skus.length !== SKU_NAMES.length ||
    !skus.every(
      (s, i) =>
        isObj(s) &&
        s.name === SKU_NAMES[i] &&
        isNum(s.listPrice) &&
        isNum(s.costKrw) &&
        isNum(s.overheadUnits) &&
        (s.addonPrice === null || isNum(s.addonPrice)),
    )
  )
    return null;
  if (
    !Array.isArray(situations) ||
    situations.length === 0 ||
    !situations.every(
      (s) =>
        isObj(s) &&
        typeof s.name === "string" &&
        typeof s.spike === "boolean" &&
        typeof s.voucherGroup === "string" &&
        isObj(s.discount) &&
        CAMPAIGN_SKUS.every((k) => (s.discount as Record<string, unknown>)[k] === null || isNum((s.discount as Record<string, unknown>)[k])),
    )
  )
    return null;
  if (
    !Array.isArray(vouchers) ||
    !vouchers.some((v) => isObj(v) && v.name === NO_VOUCHER) ||
    !vouchers.every(
      (v) =>
        isObj(v) &&
        typeof v.name === "string" &&
        typeof v.group === "string" &&
        (v.type === "rate" || v.type === "fixed") &&
        isNum(v.value) &&
        isNum(v.min) &&
        isNum(v.cap) &&
        isNum(v.refund) &&
        typeof v.auto === "boolean" &&
        typeof v.complete === "boolean" &&
        (v.sku === ALL_SKUS || (SKU_NAMES as readonly unknown[]).includes(v.sku)),
    )
  )
    return null;
  if (!isObj(g) || !["relaxed", "normal", "caution"].every((k) => isNum(g[k]))) return null;
  return raw as Assumptions;
}

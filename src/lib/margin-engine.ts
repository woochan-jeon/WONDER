// PENEFIT 쇼피SG 프로모션 마진 엔진.
// Ported 1:1 from the reference engine that was verified against the original
// sheet (PENEFIT_쇼피SG_프로모션_마진시나리오.xlsx). Don't change the math here
// without re-running scripts/verify-margin-engine.mjs.
//
// Kept free of path aliases and non-erasable TS syntax so Node can run it
// directly (type stripping) from the verification script.

export type AmsName = "AMS 없음" | "AMS 오픈 18% (최악)" | "AMS 타겟 20% (최악)";
export const AMS_NAMES: AmsName[] = ["AMS 없음", "AMS 오픈 18% (최악)", "AMS 타겟 20% (최악)"];

export const SKU_NAMES = ["메인팩 1", "3팩 번들", "버라이어티 단품"] as const;
export type SkuName = (typeof SKU_NAMES)[number];

export const SITUATION_VOUCHER_GROUPS = ["샵", "라이브", "10.10", "없음"] as const;
export const VOUCHER_GROUPS = ["-", "샵", "라이브", "10.10"] as const;

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
  discount: Record<SkuName, number | null>;
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
  note?: string;
};

export type Assumptions = {
  fees: { shopee: number; pg: number; payoneer: number; spikeDayExtra: number };
  ams: Record<AmsName, number>;
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
export type VoucherStatus = "-" | "적용" | "미달";

// ===== 가정 (Assumptions) =====
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  fees: { shopee: 0.11, pg: 0.03, payoneer: 0.009, spikeDayExtra: 0.01 },
  ams: { "AMS 없음": 0, "AMS 오픈 18% (최악)": 0.18, "AMS 타겟 20% (최악)": 0.2 },
  logistics: { lastMile: 2.03, gobizRate: 0.7, gobizOn: true, perUnitOverhead: 2.268881654, fxKrwPerSgd: 1104 },
  skus: [
    { name: "메인팩 1", listPrice: 27.8, costKrw: 3572, overheadUnits: 1, addonPrice: null, note: "6색 평균 원가" },
    { name: "3팩 번들", listPrice: 74.8, costKrw: 10631.4, overheadUnits: 3, addonPrice: null, note: "번들 5종 평균 원가" },
    { name: "버라이어티 단품", listPrice: 12.8, costKrw: 1400, overheadUnits: 1, addonPrice: 9.8, note: "메인팩·번들과 함께 사면 애드온가 적용" },
  ],
  situations: [
    { name: "평시", discount: { "메인팩 1": 0, "3팩 번들": 0, "버라이어티 단품": 0 }, spike: false, voucherGroup: "샵", note: "상시가 판매" },
    { name: "라이브 기본 (1·2·5회)", discount: { "메인팩 1": 0.22, "3팩 번들": 0.35, "버라이어티 단품": 0.2 }, spike: false, voucherGroup: "라이브", note: "스트리밍가" },
    { name: "라이브 스페셜 (3·4·6회)", discount: { "메인팩 1": 0.22, "3팩 번들": 0.35, "버라이어티 단품": 0.2 }, spike: true, voucherGroup: "라이브", note: "10/10·10/15·10/25 스파이크데이" },
    { name: "옥션", discount: { "메인팩 1": 0.5, "3팩 번들": 0.5, "버라이어티 단품": null }, spike: true, voucherGroup: "없음", note: "버라이어티 옥션 진행 안 함. 스페셜 회차 기준" },
    { name: "10.10 (10/9-10/12)", discount: { "메인팩 1": 0, "3팩 번들": 0, "버라이어티 단품": 0 }, spike: true, voucherGroup: "10.10", note: "바우처 캠페인, 상품가는 상시가" },
    { name: "10.10 (10/13-10/17)", discount: { "메인팩 1": 0, "3팩 번들": 0, "버라이어티 단품": 0 }, spike: false, voucherGroup: "10.10", note: "바우처 캠페인, 상품가는 상시가" },
    { name: "10.18 GDD", discount: { "메인팩 1": 0.35, "3팩 번들": 0.4, "버라이어티 단품": 0.15 }, spike: false, voucherGroup: "샵", note: "최근 1개월 최저가보다 4% 이상 낮아야 승인" },
  ],
  vouchers: [
    { name: "바우처 없음", group: "-", type: "fixed", value: 0, min: 0, cap: 0, refund: 0, auto: false },
    { name: "샵 T1 5% (S$30↑)", group: "샵", type: "rate", value: 0.05, min: 30, cap: 0, refund: 0, auto: true },
    { name: "샵 T2 10% (S$50↑)", group: "샵", type: "rate", value: 0.1, min: 50, cap: 0, refund: 0, auto: true },
    { name: "샵 T3 15% (S$60↑)", group: "샵", type: "rate", value: 0.15, min: 60, cap: 0, refund: 0, auto: true },
    { name: "샵 T4 20% (S$100↑)", group: "샵", type: "rate", value: 0.2, min: 100, cap: 0, refund: 0, auto: true },
    { name: "팔로우 S$1", group: "샵", type: "fixed", value: 1, min: 0, cap: 0, refund: 0, auto: false, note: "팔로워 확보용" },
    { name: "신규 구매자 S$2 (S$20↑)", group: "샵", type: "fixed", value: 2, min: 20, cap: 0, refund: 0, auto: false },
    { name: "라이브 Early S$5 (S$20↑)", group: "라이브", type: "fixed", value: 5, min: 20, cap: 0, refund: 0, auto: true },
    { name: "라이브 Default S$3 (S$20↑)", group: "라이브", type: "fixed", value: 3, min: 20, cap: 0, refund: 0, auto: true },
    { name: "라이브 Flash S$5 (S$30↑)", group: "라이브", type: "fixed", value: 5, min: 30, cap: 0, refund: 0, auto: true },
    { name: "라이브 Stock-Up S$8 (S$44↑)", group: "라이브", type: "fixed", value: 8, min: 44, cap: 0, refund: 0, auto: true },
    { name: "10.10 Co-Share 20%", group: "10.10", type: "rate", value: 0.2, min: 25, cap: 5, refund: 0.2, auto: true, note: "환급률 1/5는 크로스보더 적용 여부 미확정" },
    { name: "10.10 15%", group: "10.10", type: "rate", value: 0.15, min: 25, cap: 5, refund: 0, auto: true },
    { name: "10.10 18%", group: "10.10", type: "rate", value: 0.18, min: 10, cap: 3, refund: 0, auto: true },
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
export const feeRate = (A: Assumptions, sit: Situation, amsName: string) =>
  baseFeeRate(A) + (sit.spike ? A.fees.spikeDayExtra : 0) + amsRate(A, amsName);
export const amsRate = (A: Assumptions, amsName: string) => A.ams[amsName as AmsName] ?? 0;

export const findVoucher = (A: Assumptions, n: string) => A.vouchers.find((v) => v.name === n);
export const findSituation = (A: Assumptions, n: string) => A.situations.find((s) => s.name === n);
export const findSku = (A: Assumptions, n: string) => A.skus.find((s) => s.name === n);

export function voucherDiscount(v: Voucher | null | undefined, amount: number): number {
  if (!v || amount <= 0) return 0;
  if (v.type === "rate") return Math.min(amount * v.value, v.cap === 0 ? amount : v.cap);
  return v.value;
}

// 자동(최대 할인) 바우처 선택: 시뮬레이터 F열 로직
export function autoVoucher(A: Assumptions, sit: Situation, amount: number): Voucher | null {
  let best: Voucher | null = null;
  let bestD = 0;
  for (const v of A.vouchers) {
    const groupOk = (v.group === "샵" && sit.voucherGroup !== "없음") || v.group === sit.voucherGroup;
    if (!v.auto || amount <= 0 || amount < v.min || !groupOk) continue;
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
  ams: number;
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
  amsName: string;
  voucherSel: string;
};

// 한 줄(주문) 계산
function settle(A: Assumptions, { listTotal, discounted, productCost, logistics, sit, amsName, voucherSel }: SettleInput): Settlement {
  const rate = feeRate(A, sit, amsName);
  let voucher: Voucher | null = null;
  let status: VoucherStatus = "-";
  if (discounted > 0) {
    const chosen = voucherSel === AUTO_VOUCHER ? autoVoucher(A, sit, discounted) : findVoucher(A, voucherSel);
    if (chosen && chosen.name !== NO_VOUCHER) {
      status = discounted < chosen.min ? "미달" : "적용";
      voucher = chosen;
    }
  }
  const vDisc = status === "적용" ? voucherDiscount(voucher, discounted) : 0;
  const refund = vDisc * (voucher?.refund ?? 0);
  const pay = discounted - vDisc;
  const fee = pay * rate;
  const margin = pay - fee - productCost - logistics + refund;
  const breakEven = pay === 0 ? 0 : (productCost + logistics) / (1 - rate);
  const ams = amsRate(A, amsName);
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
    margin,
    marginRate: pay === 0 ? 0 : margin / pay,
    grade: grade(A, pay, fee + productCost + logistics - refund, margin),
    breakEvenPay: breakEven,
    maxCumulativeDiscount: listTotal === 0 ? 0 : 1 - breakEven / listTotal,
    breakdown: {
      platformFee: pay * (rate - ams) - refund,
      ams: pay * ams,
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
  ams: string;
  qty: Record<SkuName, number>;
};

export type SimRow = Settlement & { sku: SkuName; qty: number };
export type SimCombined = Settlement & { qty: number; vsSeparate: number };
export type VoucherCell = number | "-" | "미달";
export type VoucherTableRow = { voucher: string; min: number; cells: VoucherCell[] };

export type SimResult = {
  feeRate: number;
  spike: boolean;
  rows: SimRow[];
  combined: SimCombined;
  voucherTable: VoucherTableRow[];
};

export function simulate(A: Assumptions, input: SimInput): SimResult {
  const sit = findSituation(A, input.situation) ?? A.situations[0];
  const lm = lastMileNet(A);
  const rows: SimRow[] = A.skus.map((sku) => {
    const q = input.qty[sku.name] ?? 0;
    const d = sit.discount[sku.name];
    const listTotal = d === null ? 0 : sku.listPrice * q;
    const discounted = d === null ? 0 : listTotal * (1 - d);
    return {
      sku: sku.name,
      qty: q,
      ...settle(A, {
        listTotal,
        discounted,
        sit,
        amsName: input.ams,
        voucherSel: input.voucher,
        productCost: discounted === 0 ? 0 : unitCost(A, sku) * q,
        logistics: discounted === 0 ? 0 : lm,
      }),
    };
  });
  // 함께 구매(한 주문): 메인팩/번들이 있으면 버라이어티는 애드온가
  const [m, b, v] = rows;
  const vs = findSku(A, "버라이어티 단품");
  const vDiscounted = v.listTotal === 0 ? 0 : m.qty + b.qty > 0 ? (vs?.addonPrice ?? 0) * v.qty : v.discounted;
  const discounted = m.discounted + b.discounted + vDiscounted;
  const combinedBase = {
    qty: m.qty + b.qty + v.qty,
    ...settle(A, {
      listTotal: m.listTotal + b.listTotal + v.listTotal,
      discounted,
      sit,
      amsName: input.ams,
      voucherSel: input.voucher,
      productCost: m.productCost + b.productCost + v.productCost,
      logistics: discounted === 0 ? 0 : lm,
    }),
  };
  const combined: SimCombined = {
    ...combinedBase,
    vsSeparate: combinedBase.margin - rows.reduce((s, r) => s + r.margin, 0),
  };
  // 바우처별 마진 표
  const voucherTable = A.vouchers.map((vo) => {
    const cell = (r: Settlement): VoucherCell => {
      if (r.discounted === 0) return "-";
      if (r.discounted < vo.min) return "미달";
      const vd = voucherDiscount(vo, r.discounted);
      return (r.discounted - vd) * (1 - r.feeRate) - r.productCost - r.logistics + vd * vo.refund;
    };
    return { voucher: vo.name, min: vo.min, cells: [...rows.map(cell), cell(combined)] };
  });
  return { feeRate: feeRate(A, sit, input.ams), spike: sit.spike, rows, combined, voucherTable };
}

// ===== 시나리오 목록 =====
export type ScenarioRow = Settlement & {
  id: string;
  situation: string;
  sku: SkuName;
  marginAmsOpen: number;
  marginAmsTarget: number;
  orderFixedCost: number;
};

// 시나리오 한 줄을 임의의 AMS 조건으로 계산 (시나리오 목록 = AMS 없음)
export function settleScenario(A: Assumptions, sit: Situation, sku: Sku, voucherName: string, amsName: string): Settlement {
  const d = sit.discount[sku.name] ?? 0;
  const listTotal = sku.listPrice;
  const discounted = listTotal * (1 - d);
  return settle(A, { listTotal, discounted, productCost: unitCost(A, sku), logistics: lastMileNet(A), sit, amsName, voucherSel: voucherName });
}

export function scenarioList(A: Assumptions): ScenarioRow[] {
  const out: ScenarioRow[] = [];
  const lm = lastMileNet(A);
  for (const sit of A.situations)
    for (const sku of A.skus) {
      if (sit.discount[sku.name] === null) continue;
      const vs = A.vouchers.filter((v) => v.name === NO_VOUCHER || v.group === sit.voucherGroup);
      for (const vo of vs) {
        const base = settleScenario(A, sit, sku, vo.name, "AMS 없음");
        out.push({
          ...base,
          id: `${sit.name}|${sku.name}|${vo.name}`,
          situation: sit.name,
          sku: sku.name,
          voucher: vo.name,
          voucherStatus: vo.name === NO_VOUCHER ? "-" : base.voucherStatus,
          marginAmsOpen: base.margin - base.pay * A.ams["AMS 오픈 18% (최악)"],
          marginAmsTarget: base.margin - base.pay * A.ams["AMS 타겟 20% (최악)"],
          orderFixedCost: unitCost(A, sku) + lm,
        });
      }
    }
  return out;
}

// ===== 저장값 검증 =====
// localStorage / JSON 가져오기에서 읽은 값이 엔진이 기대하는 모양인지 확인한다.
// SKU·상황 이름과 AMS 이름은 화면에서 바꿀 수 없으므로 기본값과 같아야 한다.
export function parseAssumptions(raw: unknown): Assumptions | null {
  const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
  if (!isObj(raw)) return null;
  const { fees, ams, logistics, skus, situations, vouchers, grade: g } = raw;
  if (!isObj(fees) || !["shopee", "pg", "payoneer", "spikeDayExtra"].every((k) => isNum(fees[k]))) return null;
  if (!isObj(ams) || !AMS_NAMES.every((k) => isNum(ams[k]))) return null;
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
        SKU_NAMES.every((k) => (s.discount as Record<string, unknown>)[k] === null || isNum((s.discount as Record<string, unknown>)[k])),
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
        typeof v.auto === "boolean",
    )
  )
    return null;
  if (!isObj(g) || !["relaxed", "normal", "caution"].every((k) => isNum(g[k]))) return null;
  return raw as Assumptions;
}

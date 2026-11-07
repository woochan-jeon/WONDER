// Checks src/lib/margin-engine.ts against the 「PENEFIT 쇼피SG 프로모션 마진」 Google Sheet
// (시뮬레이터·시나리오 목록 탭 표시값, 2026-11-07 조회). Node 22.18+ strips the
// TypeScript types on import, so no build step is needed:
//
//   npm run verify:margin

import {
  AUTO_VOUCHER,
  DEFAULT_ASSUMPTIONS as A,
  NO_VOUCHER as NO_VOUCHER_NAME,
  parseAssumptions,
  scenarioList,
  simulate,
} from "../src/lib/margin-engine.ts";

let failures = 0;
let checks = 0;

function eq(label, actual, expected, eps = 1e-6) {
  checks++;
  const ok =
    typeof expected === "number" && typeof actual === "number" ? Math.abs(actual - expected) <= eps : actual === expected;
  if (!ok) {
    failures++;
    console.error(`✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
// 시트 표시값(반올림)과 비교
const close = (label, actual, expected, digits = 2) =>
  typeof actual === "number" ? eq(label, Number(actual.toFixed(digits)), expected, 1e-9) : eq(label, actual, expected);

const qty = (m, b, v, c = 0) => ({ "메인팩 1": m, "3팩 번들": b, "버라이어티 단품": v, "컴플리트 세트": c });

// ===== 1. 시뮬레이터 — 시트 현재 상태 (11.11 캠페인, 자동, 수량 1·0·1·1) =====
{
  const r = simulate(A, { situation: "11.11 캠페인 (10/30-11/18)", voucher: AUTO_VOUCHER, qty: qty(1, 0, 1, 1) });
  close("1 feeRate", r.feeRate, 0.149, 3);
  eq("1 spike", r.spike, false);
  // [이름, 행, 바우처, 바우처 할인, 환급, 결제가, 수수료, 상품 비용, 물류, 마진, 마진율, 등급, 손익분기, 최대 누적 할인율]
  const expected = [
    ["메인팩 1", r.rows[0], "11.11 Co-Share 20% (S$15↑, 캡 S$5)", 5, 1, 22.8, 3.4, 5.5, 0.61, 14.29, 0.627, "여유", 7.18, 0.742],
    ["3팩 번들", r.rows[1], null, 0, 0, 0, 0, 0, 0, 0, 0, "-", 0, 0],
    ["버라이어티", r.rows[2], null, 0, 0, 12.8, 1.91, 3.54, 0.61, 6.75, 0.527, "여유", 4.87, 0.619],
    ["컴플리트", r.rows[3], "샵 30% (S$80↑, 캡 S$40)", 40, 0, 98.8, 14.72, 33.03, 0.61, 50.44, 0.511, "여유", 39.52, 0.715],
    ["합계", r.combined, "샵 15% (S$15↑)", 5.64, 0, 31.96, 4.76, 9.04, 0.61, 17.55, 0.549, "여유", 11.34, 0.721],
  ];
  for (const [name, row, v, vd, refund, pay, fee, pc, lg, margin, mr, g, be, maxd] of expected) {
    const p = `1 ${name}`;
    eq(`${p} voucher`, row.voucher, v);
    close(`${p} voucherDiscount`, row.voucherDiscount, vd);
    close(`${p} refund`, row.refund, refund);
    close(`${p} pay`, row.pay, pay);
    close(`${p} fee`, row.fee, fee);
    close(`${p} productCost`, row.productCost, pc);
    close(`${p} logistics`, row.logistics, lg);
    close(`${p} margin`, row.margin, margin);
    close(`${p} marginRate`, row.marginRate, mr, 3);
    eq(`${p} grade`, row.grade, g);
    close(`${p} breakEvenPay`, row.breakEvenPay, be);
    close(`${p} maxCumulativeDiscount`, row.maxCumulativeDiscount, maxd, 3);
    eq(`${p} totalCost = pay − margin`, row.totalCost, row.pay - row.margin);
  }
  close("1 합계 discounted (애드온가)", r.combined.discounted, 37.6);
  close("1 합계 discountRate", r.combined.discountRate, 0.074, 3);
  close("1 합계 cumulativeDiscount", r.combined.cumulativeDiscount, 0.213, 3);
  close("1 vsSeparate", r.combined.vsSeparate, -3.49);

  const bd = r.combined.breakdown;
  eq("1 breakdown sum = pay", bd.margin + bd.platformFee + bd.productCost + bd.logistics, r.combined.pay);
  const bdm = r.rows[0].breakdown;
  eq("1 메인팩 breakdown sum = pay (환급 포함)", bdm.margin + bdm.platformFee + bdm.productCost + bdm.logistics, r.rows[0].pay);

  const T = Object.fromEntries(r.voucherTable.map((row) => [row.voucher, row.cells]));
  const vt = {
    "바우처 없음": [17.54, "-", 6.75, 22.35, 84.48],
    "샵 15% (S$15↑)": [14.0, "-", "미달", 17.55, 66.77],
    "샵 23% (S$50↑)": ["미달", "-", "미달", "미달", 57.32],
    "샵 25% (S$60↑)": ["미달", "-", "미달", "미달", 54.95],
    "샵 30% (S$80↑, 캡 S$40)": ["미달", "-", "미달", "미달", 50.44],
    "팔로우 S$1 (S$10↑)": [16.69, "-", 5.9, 21.5, 83.63],
    "신규 구매자 S$2 (S$20↑)": [15.84, "-", "미달", 20.65, 82.78],
    "재구매자 S$1 (S$15↑)": [16.69, "-", "미달", 21.5, 83.63],
    "라이브 메인팩 30% (S$14↑, 캡 S$7)": [11.59, "-", "대상 아님", "대상 아님", "적용 불가"],
    "라이브 3팩 30% (S$60↑, 캡 S$25)": ["대상 아님", "-", "대상 아님", "대상 아님", "적용 불가"],
    "라이브 버라이어티 S$2 (S$9↑)": ["대상 아님", "-", 5.04, "대상 아님", "적용 불가"],
    "11.11 Co-Share 20% (S$15↑, 캡 S$5)": [14.29, "-", "미달", 19.09, "적용 불가"],
  };
  eq("1 voucherTable rows", r.voucherTable.length, Object.keys(vt).length);
  // 시트는 컴플리트 열의 '바우처 없음'을 '적용 불가'로 두지만 엔진은 바우처 없이 산 마진(84.48)을 보여준다
  for (const [name, cells] of Object.entries(vt)) cells.forEach((c, i) => close(`1 voucherTable ${name}[${i}]`, T[name]?.[i], c));
}

// ===== 2. 자동 바우처 — 라이브·플래시딜 =====
{
  // 라이브: SKU 전용 라이브 바우처는 단독 주문에만, 함께 구매는 샵 바우처
  const r = simulate(A, { situation: "라이브 (11/7·11/8)", voucher: AUTO_VOUCHER, qty: qty(1, 1, 1) });
  eq("2 라이브 메인 voucher", r.rows[0].voucher, "라이브 메인팩 30% (S$14↑, 캡 S$7)");
  close("2 라이브 메인 margin", r.rows[0].margin, 6.8);
  eq("2 라이브 3팩 voucher", r.rows[1].voucher, "샵 15% (S$15↑)"); // 라이브 3팩(S$60↑)은 48.62로 미달
  eq("2 라이브 버라이어티 voucher", r.rows[2].voucher, "라이브 버라이어티 S$2 (S$9↑)");
  close("2 라이브 버라이어티 margin", r.rows[2].margin, 2.87);
  eq("2 라이브 합계 voucher 샵", r.combined.voucher?.startsWith("샵"), true);

  // 라이브 바우처를 직접 골라도 함께 구매에는 '대상 아님'
  const m = simulate(A, { situation: "라이브 (11/7·11/8)", voucher: "라이브 메인팩 30% (S$14↑, 캡 S$7)", qty: qty(1, 0, 1) });
  eq("2 직접 선택 합계 status", m.combined.voucherStatus, "대상 아님");
  eq("2 직접 선택 합계 voucherDiscount", m.combined.voucherDiscount, 0);
  eq("2 직접 선택 버라이어티 status", m.rows[2].voucherStatus, "대상 아님");
  eq("2 직접 선택 메인 status", m.rows[0].voucherStatus, "적용");

  // 플래시딜: 버라이어티 진행 안 함, 3팩 번들과 함께 사도 버라이어티 애드온가 없음
  const f = simulate(A, { situation: "샵 플래시딜 18%", voucher: AUTO_VOUCHER, qty: qty(1, 1, 1) });
  eq("2 플래시 버라이어티 pay", f.rows[2].pay, 0);
  close("2 플래시 메인 discounted", f.rows[0].discounted, 22.8);
  close("2 플래시 3팩 discounted", f.rows[1].discounted, 61.34);

  const b = simulate(A, { situation: "평시", voucher: AUTO_VOUCHER, qty: qty(0, 1, 1) });
  close("2 3팩+버라이어티 = 상시가 (애드온 없음)", b.combined.discounted, 74.8 + 12.8);
}

// ===== 2b. 수기 할인율: 상황 할인율 대신 모든 SKU에, 애드온가 없음, 바우처는 따로 =====
{
  const r = simulate(A, { situation: "샵 플래시딜 18%", voucher: NO_VOUCHER_NAME, discount: 0.2, qty: qty(1, 0, 1, 1) });
  close("2b 메인 discounted", r.rows[0].discounted, 22.24);
  close("2b 메인 discountRate", r.rows[0].discountRate, 0.2, 3);
  close("2b 버라이어티 (플래시딜 미진행이어도 수기면 계산)", r.rows[2].discounted, 10.24);
  close("2b 컴플리트도 수기 할인", r.rows[3].discounted, 111.04);
  close("2b 합계 애드온가 없음", r.combined.discounted, 22.24 + 10.24);
  const v = simulate(A, { situation: "평시", voucher: "샵 15% (S$15↑)", discount: 0.1, qty: qty(1, 0, 0) }).rows[0];
  close("2b 할인 후 바우처", v.voucherDiscount, 3.75); // 25.02 × 15%
  close("2b 누적 할인율", v.cumulativeDiscount, 0.235, 3);
  const n = simulate(A, { situation: "라이브 (11/7·11/8)", voucher: AUTO_VOUCHER, discount: null, qty: qty(1, 0, 0) }).rows[0];
  close("2b null = 상황 할인율", n.discountRate, 0.22, 3);
}

// ===== 3. 시나리오 목록 (시트 표시값) =====
{
  const list = scenarioList(A);
  const find = (sit, sku, v) => list.find((r) => r.situation === sit && r.sku === sku && r.voucher === v);
  // [상황, SKU, 바우처, 적용, 결제가, 마진]
  const samples = [
    ["평시", "메인팩 1", "바우처 없음", "-", 27.8, 17.54],
    ["평시", "메인팩 1", "샵 15% (S$15↑)", "적용", 23.63, 14.0],
    ["평시", "메인팩 1", "샵 30% (S$80↑, 캡 S$40)", "미달", 27.8, 17.54],
    ["평시", "3팩 번들", "샵 25% (S$60↑)", "적용", 56.1, 30.7],
    ["평시", "버라이어티 단품", "팔로우 S$1 (S$10↑)", "적용", 11.8, 5.9],
    ["평시", "버라이어티 단품", "재구매자 S$1 (S$15↑)", "미달", 12.8, 6.75],
    ["라이브 (11/7·11/8)", "메인팩 1", "라이브 메인팩 30% (S$14↑, 캡 S$7)", "적용", 15.18, 6.8],
    ["라이브 (11/7·11/8)", "3팩 번들", "라이브 3팩 30% (S$60↑, 캡 S$25)", "미달", 48.62, 24.33],
    ["라이브 (11/7·11/8)", "버라이어티 단품", "라이브 버라이어티 S$2 (S$9↑)", "적용", 8.24, 2.87],
    ["샵 플래시딜 10%", "메인팩 1", "11.11 Co-Share 20% (S$15↑, 캡 S$5)", "적용", 20.02, 11.92],
    ["샵 플래시딜 10%", "3팩 번들", "샵 25% (S$60↑)", "적용", 50.49, 25.92],
    ["샵 플래시딜 15%", "메인팩 1", "11.11 Co-Share 20% (S$15↑, 캡 S$5)", "적용", 18.9, 10.92],
    ["샵 플래시딜 18%", "3팩 번들", "샵 23% (S$50↑)", "적용", 47.23, 23.15],
    ["11.11 캠페인 (10/30-11/18)", "3팩 번들", "11.11 Co-Share 20% (S$15↑, 캡 S$5)", "적용", 69.8, 43.35],
    ["11.11 캠페인 (10/30-11/18)", "버라이어티 단품", "11.11 Co-Share 20% (S$15↑, 캡 S$5)", "미달", 12.8, 6.75],
    ["11.11 당일", "메인팩 1", "바우처 없음", "-", 27.8, 17.27],
    ["11.11 당일", "3팩 번들", "11.11 Co-Share 20% (S$15↑, 캡 S$5)", "적용", 69.8, 42.66],
    ["11.11 당일", "버라이어티 단품", "바우처 없음", "-", 12.8, 6.62],
    ["평시", "컴플리트 세트", "바우처 없음", "-", 138.8, 84.48],
    ["평시", "컴플리트 세트", "샵 30% (S$80↑, 캡 S$40)", "적용", 98.8, 50.44],
    ["평시", "컴플리트 세트", "재구매자 S$1 (S$15↑)", "적용", 137.8, 83.63],
    ["11.11 당일", "컴플리트 세트", "바우처 없음", "-", 138.8, 83.1],
    ["11.11 당일", "컴플리트 세트", "샵 30% (S$80↑, 캡 S$40)", "적용", 98.8, 49.46],
    ["11.11 당일", "컴플리트 세트", "신규 구매자 S$2 (S$20↑)", "적용", 136.8, 81.41],
  ];
  for (const [sit, sku, v, st, pay, margin] of samples) {
    const p = `3 ${sit}/${sku}/${v}`;
    const row = find(sit, sku, v);
    if (!row) {
      failures++;
      console.error(`✗ ${p}: row missing`);
      continue;
    }
    eq(`${p} status`, row.voucherStatus, st);
    close(`${p} pay`, row.pay, pay);
    close(`${p} margin`, row.margin, margin);
  }
  close("3 메인팩 주문 고정비", find("평시", "메인팩 1", "바우처 없음")?.orderFixedCost, 6.11);
  close("3 컴플리트 주문 고정비", find("평시", "컴플리트 세트", "바우처 없음")?.orderFixedCost, 33.64);

  // 컴플리트 세트는 평시·11.11 당일 두 상황만, 라이브·11.11 바우처 없음
  const complete = list.filter((r) => r.sku === "컴플리트 세트");
  eq("3 컴플리트 상황", [...new Set(complete.map((r) => r.situation))].join(), "평시,11.11 당일");
  eq("3 컴플리트 행 수", complete.length, 16); // 상황당 바우처 없음 + 컴플리트 적용 7종
  eq("3 컴플리트 non-complete 바우처 없음", complete.some((r) => r.voucher?.startsWith("라이브") || r.voucher?.startsWith("11.11")), false);
  // 플래시딜엔 버라이어티 없음, 라이브 바우처는 그 SKU에만
  eq("3 플래시딜 버라이어티 없음", list.some((r) => r.situation.startsWith("샵 플래시딜") && r.sku === "버라이어티 단품"), false);
  eq(
    "3 라이브 바우처 SKU 전용",
    list.some((r) => r.voucher === "라이브 3팩 30% (S$60↑, 캡 S$25)" && r.sku !== "3팩 번들"),
    false,
  );
  eq("3 옛 프로모션 없음", list.some((r) => /10\.10|10\.18|옥션|T[1-4]/.test(`${r.situation} ${r.voucher}`)), false);
}

// ===== 저장값 검증 =====
eq("parseAssumptions(defaults)", parseAssumptions(JSON.parse(JSON.stringify(A))) !== null, true);
eq("parseAssumptions(garbage)", parseAssumptions({ fees: 1 }), null);
{
  // 예전 형식: AMS 포함, 바우처에 sku 없음, SKU 3개
  const old = JSON.parse(JSON.stringify(A));
  old.ams = { "AMS 없음": 0 };
  old.skus = old.skus.slice(0, 3);
  for (const v of old.vouchers) {
    delete v.sku;
    delete v.complete;
  }
  const migrated = parseAssumptions(old);
  eq("parseAssumptions(old) ok", migrated !== null, true);
  eq("parseAssumptions(old) ams 제거", migrated && "ams" in migrated, false);
  eq("parseAssumptions(old) skus", JSON.stringify(migrated?.skus), JSON.stringify(A.skus));
  eq("parseAssumptions(old) sku 기본값", migrated?.vouchers.every((v) => v.sku === "전체"), true);
}

if (failures) {
  console.error(`\n${failures}/${checks} checks failed`);
  process.exit(1);
}
console.log(`✓ all ${checks} checks passed`);

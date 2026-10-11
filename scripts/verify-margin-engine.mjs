// Checks src/lib/margin-engine.ts against the cached values of the original
// sheet (PENEFIT_쇼피SG_프로모션_마진시나리오.xlsx). Node 22.18+ strips the
// TypeScript types on import, so no build step is needed:
//
//   npm run verify:margin

import {
  AUTO_VOUCHER,
  DEFAULT_ASSUMPTIONS as A,
  parseAssumptions,
  scenarioList,
  simulate,
} from "../src/lib/margin-engine.ts";

const EPS = 1e-6;
let failures = 0;
let checks = 0;

function eq(label, actual, expected, eps = EPS) {
  checks++;
  const ok =
    typeof expected === "number" && typeof actual === "number"
      ? Math.abs(actual - expected) <= eps
      : actual === expected;
  if (!ok) {
    failures++;
    console.error(`✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const qty = (m, b, v, c = 0) => ({ "메인팩 1": m, "3팩 번들": b, "버라이어티 단품": v, "컴플리트 세트": c });

// ===== 8.1 시뮬레이터 — 원본 시트 현재 상태 =====
{
  const r = simulate(A, {
    situation: "10.10 (10/9-10/12)",
    voucher: "10.10 Co-Share 20%",
    ams: "AMS 타겟 20% (최악)",
    qty: qty(1, 0, 1),
  });
  eq("8.1 feeRate", r.feeRate, 0.359);
  const expected = [
    ["메인팩 1", r.rows[0], "10.10 Co-Share 20%", "적용", 5, 1, 22.8, 8.1852, 5.5043889, 0.609, 9.5014111, 0.4167286, "보통", 9.5372682],
    ["3팩 번들", r.rows[1], null, "-", 0, 0, 0, 0, 0, 0, 0, 0, "-", 0],
    ["버라이어티", r.rows[2], "10.10 Co-Share 20%", "미달", 0, 0, 12.8, 4.5952, 3.5369976, 0.609, 4.0588024, 0.3170939, "주의", 6.468015],
    ["합계", r.combined, "10.10 Co-Share 20%", "적용", 5, 1, 32.6, 11.7034, 9.0413865, 0.609, 12.2462135, 0.3756507, "보통", 15.0552051],
  ];
  for (const [name, row, v, st, vd, refund, pay, fee, pc, lg, margin, mr, g, be] of expected) {
    const p = `8.1 ${name}`;
    eq(`${p} voucher`, row.voucher, v);
    eq(`${p} status`, row.voucherStatus, st);
    eq(`${p} voucherDiscount`, row.voucherDiscount, vd);
    eq(`${p} refund`, row.refund, refund);
    eq(`${p} pay`, row.pay, pay);
    eq(`${p} fee`, row.fee, fee);
    eq(`${p} productCost`, row.productCost, pc, 1e-6);
    eq(`${p} logistics`, row.logistics, lg);
    eq(`${p} margin`, row.margin, margin, 1e-6);
    eq(`${p} marginRate`, row.marginRate, mr, 1e-6);
    eq(`${p} grade`, row.grade, g);
    eq(`${p} breakEvenPay`, row.breakEvenPay, be, 1e-6);
  }
  eq("8.1 합계 discountRate", r.combined.discountRate, 0.0738916, 1e-6);
  eq("8.1 합계 cumulativeDiscount", r.combined.cumulativeDiscount, 0.1970443, 1e-6);
  eq("8.1 합계 maxCumulativeDiscount", r.combined.maxCumulativeDiscount, 0.6291821, 1e-6);
  eq("8.1 vsSeparate", r.combined.vsSeparate, -1.314);

  const bd = r.combined.breakdown;
  eq("8.1 breakdown margin", bd.margin, 12.2462135, 1e-6);
  eq("8.1 breakdown ams", bd.ams, 6.52);
  eq("8.1 breakdown platformFee", bd.platformFee, 4.1834);
  eq("8.1 breakdown productCost", bd.productCost, 9.0413865, 1e-6);
  eq("8.1 breakdown logistics", bd.logistics, 0.609);
  eq("8.1 breakdown sum = pay", bd.margin + bd.ams + bd.platformFee + bd.productCost + bd.logistics, r.combined.pay);

  const T = Object.fromEntries(r.voucherTable.map((row) => [row.voucher, row.cells]));
  const vt = {
    "바우처 없음": [11.7064111, "-", 4.0588024, 14.4512135],
    "샵 T1 5% (S$30↑)": ["미달", "-", "미달", 13.2461335],
    "샵 T2 10% (S$50↑)": ["미달", "-", "미달", "미달"],
    "샵 T3 15% (S$60↑)": ["미달", "-", "미달", "미달"],
    "샵 T4 20% (S$100↑)": ["미달", "-", "미달", "미달"],
    "팔로우 S$1": [11.0654111, "-", 3.4178024, 13.8102135],
    "신규 구매자 S$2 (S$20↑)": [10.4244111, "-", "미달", 13.1692135],
    "라이브 Early S$5 (S$20↑)": [8.5014111, "-", "미달", 11.2462135],
    "라이브 Default S$3 (S$20↑)": [9.7834111, "-", "미달", 12.5282135],
    "라이브 Flash S$5 (S$30↑)": ["미달", "-", "미달", 11.2462135],
    "라이브 Stock-Up S$8 (S$44↑)": ["미달", "-", "미달", "미달"],
    "10.10 Co-Share 20%": [9.5014111, "-", "미달", 12.2462135],
    "10.10 15%": [9.0334411, "-", "미달", 11.2462135],
    "10.10 18%": [9.7834111, "-", 2.5819384, 12.5282135],
  };
  eq("8.1 voucherTable rows", r.voucherTable.length, 14);
  for (const [name, cells] of Object.entries(vt)) {
    cells.forEach((c, i) => eq(`8.1 voucherTable ${name}[${i}]`, T[name]?.[i], c, 1e-6));
  }
}

// ===== 8.2 시나리오 목록 =====
{
  const list = scenarioList(A);
  eq("8.2 row count", list.length, 147);
  const counts = {};
  for (const r of list) counts[r.situation] = (counts[r.situation] ?? 0) + 1;
  const expectedCounts = {
    // 각 상황 + 컴플리트 세트 7행 (바우처 없음 + 컴플리트 적용 6종)
    "평시": 28,
    "라이브 기본 (1·2·5회)": 22,
    "라이브 스페셜 (3·4·6회)": 22,
    "옥션": 9,
    "10.10 (10/9-10/12)": 19,
    "10.10 (10/13-10/17)": 19,
    "10.18 GDD": 28,
  };
  for (const [s, n] of Object.entries(expectedCounts)) eq(`8.2 count ${s}`, counts[s], n);

  const samples = [
    ["평시", "메인팩 1", "바우처 없음", "-", 27.8, 17.5444111, 0.6310939, "여유", 12.5404111, 11.9844111],
    ["평시", "메인팩 1", "샵 T1 5% (S$30↑)", "미달", 27.8, 17.5444111, 0.6310939, "여유", 12.5404111, 11.9844111],
    ["평시", "메인팩 1", "팔로우 S$1", "적용", 26.8, 16.6934111, 0.6228885, "여유", 11.8694111, 11.3334111],
    ["평시", "3팩 번들", "샵 T3 15% (S$60↑)", "적용", 63.58, 37.0610437, 0.5829041, "여유", 25.6166437, 24.3450437],
    ["평시", "버라이어티 단품", "바우처 없음", "-", 12.8, 6.7468024, 0.5270939, "여유", 4.4428024, 4.1868024],
  ];
  for (const [sit, sku, v, st, pay, margin, mr, g, m18, m20] of samples) {
    const p = `8.2 ${sit}/${sku}/${v}`;
    const row = list.find((r) => r.situation === sit && r.sku === sku && r.voucher === v);
    if (!row) {
      failures++;
      console.error(`✗ ${p}: row missing`);
      continue;
    }
    eq(`${p} status`, row.voucherStatus, st);
    eq(`${p} pay`, row.pay, pay);
    eq(`${p} margin`, row.margin, margin, 1e-6);
    eq(`${p} marginRate`, row.marginRate, mr, 1e-6);
    eq(`${p} grade`, row.grade, g);
    eq(`${p} AMS18`, row.marginAmsOpen, m18, 1e-6);
    eq(`${p} AMS20`, row.marginAmsTarget, m20, 1e-6);
  }
}

// ===== 8.3 자동 바우처 (표시값 반올림 비교) =====
{
  const close = (label, actual, expected, digits) => eq(label, Number(actual.toFixed(digits)), expected, 1e-9);
  const cases = [
    {
      input: { situation: "10.10 (10/9-10/12)", ams: "AMS 타겟 20% (최악)", qty: qty(1, 0, 1) },
      rows: [
        ["메인팩 1", 0, "10.10 Co-Share 20%", 22.8, 9.5, 0.417, "보통"],
        ["버라이어티", 2, "10.10 18%", 10.5, 2.58, 0.246, "주의"],
        ["합계", "combined", "10.10 Co-Share 20%", 32.6, 12.25, 0.376, "보통"],
      ],
    },
    {
      input: { situation: "라이브 스페셜 (3·4·6회)", ams: "AMS 없음", qty: qty(2, 1, 1) },
      rows: [
        ["메인팩 1", 0, "라이브 Early S$5 (S$20↑)", 38.37, 20.65, 0.538, "여유"],
        ["3팩 번들", 1, "라이브 Stock-Up S$8 (S$44↑)", 40.62, 17.12, 0.421, "보통"],
        ["버라이어티", 2, null, 10.24, 4.47, 0.436, "보통"],
        ["합계", "combined", "샵 T4 20% (S$100↑)", 81.43, 36.89, 0.453, "보통"],
      ],
    },
    {
      input: { situation: "옥션", ams: "AMS 오픈 18% (최악)", qty: qty(1, 0, 1) },
      rows: [
        ["메인팩 1", 0, null, 13.9, 3.07, 0.221, "위험"],
        ["버라이어티", 2, null, 0, 0, 0, "-"],
      ],
    },
  ];
  for (const { input, rows } of cases) {
    const r = simulate(A, { ...input, voucher: AUTO_VOUCHER });
    for (const [name, idx, v, pay, margin, mr, g] of rows) {
      const row = idx === "combined" ? r.combined : r.rows[idx];
      const p = `8.3 ${input.situation} ${name}`;
      eq(`${p} voucher`, row.voucher, v);
      close(`${p} pay`, row.pay, pay, 2);
      close(`${p} margin`, row.margin, margin, 2);
      close(`${p} marginRate`, row.marginRate, mr, 3);
      eq(`${p} grade`, row.grade, g);
    }
  }
}

// ===== 8.4 컴플리트 세트 (구글 시트 표시값 반올림 비교) =====
{
  const close = (label, actual, expected, digits) => eq(label, Number(actual.toFixed(digits)), expected, 1e-9);

  // 시뮬레이터 15행: 10.10 스파이크, 샵 T4, AMS 타겟 20% 선택 — 컴플리트는 AMS 0%
  const r = simulate(A, { situation: "10.10 (10/9-10/12)", voucher: "샵 T4 20% (S$100↑)", ams: "AMS 타겟 20% (최악)", qty: qty(0, 0, 0, 1) });
  const c = r.rows[3];
  eq("8.4 sku", c.sku, "컴플리트 세트");
  eq("8.4 voucher", c.voucher, "샵 T4 20% (S$100↑)");
  eq("8.4 status", c.voucherStatus, "적용");
  close("8.4 listTotal", c.listTotal, 138.8, 2);
  close("8.4 discounted", c.discounted, 138.8, 2);
  close("8.4 voucherDiscount", c.voucherDiscount, 27.76, 2);
  close("8.4 pay", c.pay, 111.04, 2);
  close("8.4 feeRate", c.feeRate, 0.159, 3);
  close("8.4 fee", c.fee, 17.66, 2);
  close("8.4 productCost", c.productCost, 33.03, 2);
  close("8.4 logistics", c.logistics, 0.61, 2);
  close("8.4 margin", c.margin, 59.75, 2);
  close("8.4 marginRate", c.marginRate, 0.538, 3);
  eq("8.4 grade", c.grade, "여유");
  close("8.4 breakEvenPay", c.breakEvenPay, 39.99, 2);
  close("8.4 maxCumulativeDiscount", c.maxCumulativeDiscount, 0.712, 3);
  eq("8.4 combined excludes complete", r.combined.pay, 0);

  const T = Object.fromEntries(r.voucherTable.map((row) => [row.voucher, row.cells[4]]));
  const vt = {
    "샵 T1 5% (S$30↑)": 77.26,
    "샵 T2 10% (S$50↑)": 71.42,
    "샵 T3 15% (S$60↑)": 65.59,
    "샵 T4 20% (S$100↑)": 59.75,
    "팔로우 S$1": 82.25,
    "신규 구매자 S$2 (S$20↑)": 81.41,
    "라이브 Early S$5 (S$20↑)": "적용 불가",
    "라이브 Stock-Up S$8 (S$44↑)": "적용 불가",
    "10.10 Co-Share 20%": "적용 불가",
    "10.10 18%": "적용 불가",
  };
  for (const [name, v] of Object.entries(vt)) {
    if (typeof v === "number") close(`8.4 voucherTable ${name}`, T[name], v, 2);
    else eq(`8.4 voucherTable ${name}`, T[name], v);
  }

  // 자동: 상황 구분 무관하게 컴플리트 적용 바우처 중 최대 (옥션 = 바우처 구분 '없음'이어도 샵 T4)
  const auto = simulate(A, { situation: "옥션", voucher: AUTO_VOUCHER, ams: "AMS 오픈 18% (최악)", qty: qty(0, 0, 0, 1) }).rows[3];
  eq("8.4 auto voucher", auto.voucher, "샵 T4 20% (S$100↑)");
  close("8.4 auto margin", auto.margin, 59.75, 2);

  // 라이브 바우처를 직접 고르면 적용 불가 (할인 0)
  const live = simulate(A, { situation: "라이브 기본 (1·2·5회)", voucher: "라이브 Early S$5 (S$20↑)", ams: "AMS 없음", qty: qty(0, 0, 0, 1) }).rows[3];
  eq("8.4 live status", live.voucherStatus, "적용 불가");
  close("8.4 live pay", live.pay, 138.8, 2);
  close("8.4 live margin", live.margin, 84.48, 2);

  // 시나리오 목록 컴플리트 행
  const list = scenarioList(A);
  const samples = [
    ["평시", "바우처 없음", "-", 138.8, 84.48, 0.609, "여유"],
    ["평시", "샵 T4 20% (S$100↑)", "적용", 111.04, 60.86, 0.548, "여유"],
    ["라이브 스페셜 (3·4·6회)", "신규 구매자 S$2 (S$20↑)", "적용", 136.8, 81.41, 0.595, "여유"],
    ["옥션", "샵 T1 5% (S$30↑)", "적용", 131.86, 77.26, 0.586, "여유"],
    ["10.18 GDD", "팔로우 S$1", "적용", 137.8, 83.63, 0.607, "여유"],
  ];
  for (const [sit, v, st, pay, margin, mr, g] of samples) {
    const p = `8.4 list ${sit}/${v}`;
    const row = list.find((x) => x.situation === sit && x.sku === "컴플리트 세트" && x.voucher === v);
    if (!row) {
      failures++;
      console.error(`✗ ${p}: row missing`);
      continue;
    }
    eq(`${p} status`, row.voucherStatus, st);
    close(`${p} pay`, row.pay, pay, 2);
    close(`${p} margin`, row.margin, margin, 2);
    close(`${p} marginRate`, row.marginRate, mr, 3);
    eq(`${p} grade`, row.grade, g);
    eq(`${p} AMS18`, row.marginAmsOpen, null);
    close(`${p} orderFixedCost`, row.orderFixedCost, 33.64, 2);
  }
  eq("8.4 list no live vouchers", list.some((x) => x.sku === "컴플리트 세트" && x.voucher?.startsWith("라이브")), false);
}

// ===== 저장값 검증 =====
eq("parseAssumptions(defaults)", parseAssumptions(JSON.parse(JSON.stringify(A))) !== null, true);
eq("parseAssumptions(garbage)", parseAssumptions({ fees: 1 }), null);
{
  // 컴플리트 세트 추가 전 저장값: SKU 3개, 바우처에 complete 없음
  const old = JSON.parse(JSON.stringify(A));
  old.skus = old.skus.slice(0, 3);
  for (const v of old.vouchers) delete v.complete;
  const migrated = parseAssumptions(old);
  eq("parseAssumptions(old) ok", migrated !== null, true);
  eq("parseAssumptions(old) skus", JSON.stringify(migrated.skus), JSON.stringify(A.skus));
  eq("parseAssumptions(old) complete flags", migrated.vouchers.map((v) => v.complete).join(), A.vouchers.map((v) => v.complete).join());
}

if (failures) {
  console.error(`\n${failures}/${checks} checks failed`);
  process.exit(1);
}
console.log(`✓ all ${checks} checks passed`);

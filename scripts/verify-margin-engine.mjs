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

const qty = (m, b, v) => ({ "메인팩 1": m, "3팩 번들": b, "버라이어티 단품": v });

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
  eq("8.2 row count", list.length, 98);
  const counts = {};
  for (const r of list) counts[r.situation] = (counts[r.situation] ?? 0) + 1;
  const expectedCounts = {
    "평시": 21,
    "라이브 기본 (1·2·5회)": 15,
    "라이브 스페셜 (3·4·6회)": 15,
    "옥션": 2,
    "10.10 (10/9-10/12)": 12,
    "10.10 (10/13-10/17)": 12,
    "10.18 GDD": 21,
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

// ===== 저장값 검증 =====
eq("parseAssumptions(defaults)", parseAssumptions(JSON.parse(JSON.stringify(A))) !== null, true);
eq("parseAssumptions(garbage)", parseAssumptions({ fees: 1 }), null);

if (failures) {
  console.error(`\n${failures}/${checks} checks failed`);
  process.exit(1);
}
console.log(`✓ all ${checks} checks passed`);

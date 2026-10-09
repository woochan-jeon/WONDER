"use client";

import { useRef, useState } from "react";
import {
  AMS_NAMES,
  NO_VOUCHER,
  SITUATION_VOUCHER_GROUPS,
  SKU_NAMES,
  VOUCHER_GROUPS,
  baseFeeRate,
  lastMileNet,
  parseAssumptions,
  unitCost,
  type Assumptions,
} from "@/lib/margin-engine";
import { Card, Hint, NumField, fmtMoney, fmtPct } from "@/components/margin-ui";

export default function AssumptionsTab({
  A,
  onChange,
  onImport,
  onReset,
  isDefault,
}: {
  A: Assumptions;
  onChange: (next: Assumptions) => void;
  onImport: (next: Assumptions) => void;
  onReset: () => void;
  isDefault: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const update = (fn: (draft: Assumptions) => void) => {
    const next = structuredClone(A);
    fn(next);
    onChange(next);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(A, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "penefit-margin-assumptions.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = parseAssumptions(JSON.parse(await file.text()));
      if (!parsed) {
        setImportError("가정 파일 형식이 맞지 않습니다. 이 화면에서 내보낸 JSON인지 확인해 주세요.");
        return;
      }
      setImportError(null);
      onImport(parsed);
    } catch {
      setImportError("JSON을 읽지 못했습니다.");
    }
  };

  const moveVoucher = (i: number, d: -1 | 1) =>
    update((x) => {
      const j = i + d;
      [x.vouchers[i], x.vouchers[j]] = [x.vouchers[j], x.vouchers[i]];
    });

  const addVoucher = () =>
    update((x) => {
      let n = 1;
      while (x.vouchers.some((v) => v.name === `새 바우처 ${n}`)) n++;
      x.vouchers.push({ name: `새 바우처 ${n}`, group: "샵", type: "fixed", value: 0, min: 0, cap: 0, refund: 0, auto: false });
    });

  const th = "px-2 py-2 text-left font-medium text-gray-500";
  const td = "px-2 py-1.5 align-middle";

  return (
    <>
      <Hint>
        통화는 SGD, 모든 수수료는 바우처 적용 후 결제가 기준입니다. 수정하면 이 브라우저에 자동 저장되고 모든 탭이 즉시 다시 계산됩니다. 회색
        값은 다른 값에서 계산되는 파생값입니다.
      </Hint>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${
            isDefault ? "bg-gray-50 text-gray-500 ring-gray-200" : "bg-amber-50 text-amber-800 ring-amber-200"
          }`}
        >
          {isDefault ? "기본값 사용 중" : "수정됨 · 이 브라우저에 저장됨"}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-40"
          >
            기본값으로 되돌리기
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50"
          >
            JSON 내보내기
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50"
          >
            JSON 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {importError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{importError}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">수수료</h2>
          <div className="space-y-2">
            <Row label="쇼피 판매 수수료">
              <NumField value={A.fees.shopee} scale={100} suffix="%" onChange={(v) => update((x) => void (x.fees.shopee = v))} />
            </Row>
            <Row label="현지 PG 수수료">
              <NumField value={A.fees.pg} scale={100} suffix="%" onChange={(v) => update((x) => void (x.fees.pg = v))} />
            </Row>
            <Row label="페이오니아 인출">
              <NumField value={A.fees.payoneer} scale={100} suffix="%" onChange={(v) => update((x) => void (x.fees.payoneer = v))} />
            </Row>
            <Row label="기본 수수료 합계" derived>
              {fmtPct(baseFeeRate(A))}
            </Row>
            <Row label="스파이크데이 추가" note="상황의 스파이크데이=Y일 때만 가산">
              <NumField
                value={A.fees.spikeDayExtra}
                scale={100}
                suffix="%"
                onChange={(v) => update((x) => void (x.fees.spikeDayExtra = v))}
              />
            </Row>
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold text-gray-900">AMS 선택지</h2>
          <div className="space-y-2">
            {AMS_NAMES.map((n) => (
              <Row key={n} label={n}>
                <NumField value={A.ams[n]} scale={100} suffix="%" onChange={(v) => update((x) => void (x.ams[n] = v))} />
              </Row>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">물류·부대비</h2>
          <div className="space-y-2">
            <Row label="Last Mile (주문당 1회)" note="0~1kg 구간. 함께 구매해도 주문당 1회">
              <NumField value={A.logistics.lastMile} suffix="S$" onChange={(v) => update((x) => void (x.logistics.lastMile = v))} />
            </Row>
            <Row label="고비즈 물류 지원비율" note="2026-06-01 ~ 10-31">
              <NumField
                value={A.logistics.gobizRate}
                scale={100}
                suffix="%"
                onChange={(v) => update((x) => void (x.logistics.gobizRate = v))}
              />
            </Row>
            <Row label="고비즈 적용 여부" note="OFF면 Last Mile 전액 셀러 부담">
              <button
                type="button"
                role="switch"
                aria-checked={A.logistics.gobizOn}
                onClick={() => update((x) => void (x.logistics.gobizOn = !x.logistics.gobizOn))}
                className={`relative h-6 w-11 rounded-full transition-colors ${A.logistics.gobizOn ? "bg-[#0066cc]" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                    A.logistics.gobizOn ? "left-[22px]" : "left-0.5"
                  }`}
                />
                <span className="sr-only">고비즈 적용</span>
              </button>
            </Row>
            <Row label="주문당 물류비 순부담" derived>
              {fmtMoney(lastMileNet(A))} <span className="text-gray-400">({lastMileNet(A).toFixed(3)})</span>
            </Row>
            <Row label="개당 부대비" note="First Mile·IOR·기타">
              <NumField
                value={A.logistics.perUnitOverhead}
                suffix="S$"
                onChange={(v) => update((x) => void (x.logistics.perUnitOverhead = v))}
              />
            </Row>
            <Row label="환율 (1 SGD =)">
              <NumField
                value={A.logistics.fxKrwPerSgd}
                suffix="₩"
                min={1}
                onChange={(v) => v > 0 && update((x) => void (x.logistics.fxKrwPerSgd = v))}
              />
            </Row>
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold text-gray-900">등급 기준 (결제가 ÷ 총비용)</h2>
          <div className="space-y-2">
            <Row label="여유 ≥">
              <NumField value={A.grade.relaxed} onChange={(v) => update((x) => void (x.grade.relaxed = v))} />
            </Row>
            <Row label="보통 ≥">
              <NumField value={A.grade.normal} onChange={(v) => update((x) => void (x.grade.normal = v))} />
            </Row>
            <Row label="주의 ≥">
              <NumField value={A.grade.caution} onChange={(v) => update((x) => void (x.grade.caution = v))} />
            </Row>
            <p className="text-[11px] text-gray-500">그 미만은 위험, 마진 &lt; 0은 역마진. 총비용 = 수수료 + 상품 비용 + 물류비 − 쇼피 환급.</p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">SKU</h2>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="text-xs">
              <tr className="border-b border-gray-200">
                <th className={th}>SKU</th>
                <th className={th}>상시가 (S$)</th>
                <th className={th}>제조원가 (₩)</th>
                <th className={th}>부대비 개수</th>
                <th className={th}>애드온가 (S$)</th>
                <th className={th}>제조원가 S$</th>
                <th className={th}>상품 비용</th>
                <th className={th}>주문 고정비</th>
                <th className={th}>비고</th>
              </tr>
            </thead>
            <tbody>
              {A.skus.map((sku, i) => (
                <tr key={sku.name} className="border-b border-gray-100">
                  <td className={`${td} font-medium text-gray-900`}>{sku.name}</td>
                  <td className={td}>
                    <NumField className="w-24" value={sku.listPrice} onChange={(v) => update((x) => void (x.skus[i].listPrice = v))} />
                  </td>
                  <td className={td}>
                    <NumField className="w-28" value={sku.costKrw} onChange={(v) => update((x) => void (x.skus[i].costKrw = v))} />
                  </td>
                  <td className={td}>
                    <NumField className="w-16" value={sku.overheadUnits} onChange={(v) => update((x) => void (x.skus[i].overheadUnits = v))} />
                  </td>
                  <td className={td}>
                    {sku.addonPrice === null ? (
                      <span className="text-gray-400">–</span>
                    ) : (
                      <NumField className="w-24" value={sku.addonPrice} onChange={(v) => update((x) => void (x.skus[i].addonPrice = v))} />
                    )}
                  </td>
                  <td className={`${td} tabular-nums text-gray-500`}>{fmtMoney(sku.costKrw / A.logistics.fxKrwPerSgd)}</td>
                  <td className={`${td} tabular-nums text-gray-500`}>{unitCost(A, sku).toFixed(4)}</td>
                  <td className={`${td} tabular-nums text-gray-500`}>{(unitCost(A, sku) + lastMileNet(A)).toFixed(4)}</td>
                  <td className={td}>
                    <TextField value={sku.note ?? ""} onCommit={(v) => update((x) => void (x.skus[i].note = v))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-gray-900">상황별 할인율 (상시가 대비)</h2>
        <p className="mb-3 mt-0.5 text-xs text-gray-500">&quot;진행 안 함&quot;인 SKU는 그 상황에서 계산 대상에서 빠집니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="text-xs">
              <tr className="border-b border-gray-200">
                <th className={th}>상황</th>
                {SKU_NAMES.map((n) => (
                  <th key={n} className={th}>
                    {n}
                  </th>
                ))}
                <th className={th}>스파이크데이</th>
                <th className={th}>자동 바우처 구분</th>
                <th className={th}>비고</th>
              </tr>
            </thead>
            <tbody>
              {A.situations.map((s, i) => (
                <tr key={s.name} className="border-b border-gray-100">
                  <td className={`${td} font-medium text-gray-900`}>{s.name}</td>
                  {SKU_NAMES.map((n) => {
                    const d = s.discount[n];
                    return (
                      <td key={n} className={td}>
                        <div className="flex items-center gap-2">
                          <NumField
                            key={String(d === null)}
                            className="w-20"
                            value={d ?? 0}
                            scale={100}
                            suffix="%"
                            disabled={d === null}
                            ariaLabel={`${s.name} ${n} 할인율`}
                            onChange={(v) => update((x) => void (x.situations[i].discount[n] = v))}
                          />
                          <label className="flex items-center gap-1 text-[11px] text-gray-500">
                            <input
                              type="checkbox"
                              checked={d === null}
                              onChange={(e) => update((x) => void (x.situations[i].discount[n] = e.target.checked ? null : 0))}
                            />
                            진행 안 함
                          </label>
                        </div>
                      </td>
                    );
                  })}
                  <td className={td}>
                    <input
                      type="checkbox"
                      aria-label={`${s.name} 스파이크데이`}
                      checked={s.spike}
                      onChange={(e) => update((x) => void (x.situations[i].spike = e.target.checked))}
                    />
                  </td>
                  <td className={td}>
                    <select
                      value={s.voucherGroup}
                      onChange={(e) => update((x) => void (x.situations[i].voucherGroup = e.target.value))}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      {SITUATION_VOUCHER_GROUPS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>
                    <TextField value={s.note ?? ""} onCommit={(v) => update((x) => void (x.situations[i].note = v))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">바우처</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              순서가 의미 있습니다 — 자동 선택에서 할인액이 같으면 위에 있는 것을 고릅니다. 캡 0 = 상한 없음.
            </p>
          </div>
          <button
            type="button"
            onClick={addVoucher}
            className="shrink-0 rounded-md bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0058b0]"
          >
            + 바우처 추가
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="text-xs">
              <tr className="border-b border-gray-200">
                <th className={th}>순서</th>
                <th className={th}>바우처</th>
                <th className={th}>구분</th>
                <th className={th}>유형</th>
                <th className={th}>할인값</th>
                <th className={th}>최소 구매액</th>
                <th className={th}>캡</th>
                <th className={th}>쇼피 환급</th>
                <th className={th}>자동 선택</th>
                <th className={th}>비고</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {A.vouchers.map((v, i) => {
                const locked = v.name === NO_VOUCHER;
                return (
                  <tr key={v.name} className="border-b border-gray-100">
                    <td className={td}>
                      <div className="flex gap-0.5">
                        <IconBtn label="위로" disabled={i === 0} onClick={() => moveVoucher(i, -1)}>
                          ↑
                        </IconBtn>
                        <IconBtn label="아래로" disabled={i === A.vouchers.length - 1} onClick={() => moveVoucher(i, 1)}>
                          ↓
                        </IconBtn>
                      </div>
                    </td>
                    <td className={td}>
                      {locked ? (
                        <span className="font-medium text-gray-900">{v.name}</span>
                      ) : (
                        <TextField
                          className="w-52"
                          value={v.name}
                          onCommit={(name, el) => {
                            const t = name.trim();
                            if (!t || (t !== v.name && A.vouchers.some((o) => o.name === t))) {
                              el.value = v.name;
                              return;
                            }
                            update((x) => void (x.vouchers[i].name = t));
                          }}
                        />
                      )}
                    </td>
                    {locked ? (
                      <td colSpan={7} className={`${td} text-xs text-gray-400`}>
                        고정 항목
                      </td>
                    ) : (
                      <>
                        <td className={td}>
                          <select
                            value={v.group}
                            onChange={(e) => update((x) => void (x.vouchers[i].group = e.target.value))}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                          >
                            {VOUCHER_GROUPS.map((g) => (
                              <option key={g}>{g}</option>
                            ))}
                          </select>
                        </td>
                        <td className={td}>
                          <select
                            value={v.type}
                            onChange={(e) => update((x) => void (x.vouchers[i].type = e.target.value as "rate" | "fixed"))}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                          >
                            <option value="rate">정률</option>
                            <option value="fixed">정액</option>
                          </select>
                        </td>
                        <td className={td}>
                          <NumField
                            key={v.type}
                            className="w-24"
                            value={v.value}
                            scale={v.type === "rate" ? 100 : 1}
                            suffix={v.type === "rate" ? "%" : "S$"}
                            onChange={(n) => update((x) => void (x.vouchers[i].value = n))}
                          />
                        </td>
                        <td className={td}>
                          <NumField className="w-20" value={v.min} onChange={(n) => update((x) => void (x.vouchers[i].min = n))} />
                        </td>
                        <td className={td}>
                          <NumField className="w-16" value={v.cap} onChange={(n) => update((x) => void (x.vouchers[i].cap = n))} />
                        </td>
                        <td className={td}>
                          <NumField
                            className="w-20"
                            value={v.refund}
                            scale={100}
                            suffix="%"
                            onChange={(n) => update((x) => void (x.vouchers[i].refund = n))}
                          />
                        </td>
                        <td className={td}>
                          <input
                            type="checkbox"
                            aria-label={`${v.name} 자동 선택 포함`}
                            checked={v.auto}
                            onChange={(e) => update((x) => void (x.vouchers[i].auto = e.target.checked))}
                          />
                        </td>
                      </>
                    )}
                    <td className={td}>
                      {!locked && <TextField value={v.note ?? ""} onCommit={(n) => update((x) => void (x.vouchers[i].note = n))} />}
                    </td>
                    <td className={td}>
                      {!locked && (
                        <IconBtn label={`${v.name} 삭제`} onClick={() => update((x) => void x.vouchers.splice(i, 1))}>
                          ✕
                        </IconBtn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Row({ label, note, derived, children }: { label: string; note?: string; derived?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-sm ${derived ? "font-medium text-gray-500" : "text-gray-900"}`}>{label}</p>
        {note && <p className="text-[11px] text-gray-500">{note}</p>}
      </div>
      <div className={`w-36 shrink-0 text-right text-sm tabular-nums ${derived ? "text-gray-500" : ""}`}>{children}</div>
    </div>
  );
}

function TextField({
  value,
  onCommit,
  className = "w-56",
}: {
  value: string;
  onCommit: (v: string, el: HTMLInputElement) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      defaultValue={value}
      onBlur={(e) => e.target.value !== value && onCommit(e.target.value, e.target)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={`rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-[#0066cc] focus:outline-none ${className}`}
    />
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

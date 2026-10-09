import type { Grade } from "@/lib/margin-engine";

// 계산은 반올림하지 않은 값으로 하고, 표시할 때만 반올림한다.
export function fmtMoney(n: number): string {
  const abs = Math.abs(n).toFixed(2);
  return n < 0 && abs !== "0.00" ? `−S$${abs}` : `S$${abs}`;
}

export function fmtSignedMoney(n: number): string {
  const abs = Math.abs(n).toFixed(2);
  if (abs === "0.00") return "S$0.00";
  return n < 0 ? `−S$${abs}` : `+S$${abs}`;
}

export function fmtPct(n: number): string {
  const s = (n * 100).toFixed(1);
  return s === "-0.0" ? "0.0%" : `${s.replace("-", "−")}%`;
}

export const GRADE_CLASS: Record<Grade, string> = {
  여유: "bg-green-50 text-green-700 ring-green-200",
  보통: "bg-blue-50 text-blue-700 ring-blue-200",
  주의: "bg-amber-50 text-amber-700 ring-amber-200",
  위험: "bg-orange-50 text-orange-700 ring-orange-200",
  역마진: "bg-red-50 text-red-700 ring-red-200",
  "-": "bg-gray-50 text-gray-400 ring-gray-200",
};

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${GRADE_CLASS[grade]}`}>
      {grade}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 ${className}`}>{children}</section>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500 ring-1 ring-gray-200">{children}</p>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-md text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
          } ${o.value === value ? "bg-white font-medium text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// 숫자 입력. scale=100이면 분수(0.11)를 퍼센트(11)로 보여주고 받는다.
// 비제어 입력이라 외부에서 값을 바꿀 땐(기본값 복원·가져오기) 부모가 key를 바꿔 다시 그린다.
export function NumField({
  value,
  onChange,
  scale = 1,
  step = "any",
  min,
  max,
  suffix,
  className = "",
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  scale?: number;
  step?: string;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={ariaLabel}
        defaultValue={Number((value * scale).toPrecision(12))}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(n / scale);
        }}
        className="w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm tabular-nums focus:border-[#0066cc] focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
      />
      {suffix && <span className="shrink-0 text-xs text-gray-500">{suffix}</span>}
    </span>
  );
}

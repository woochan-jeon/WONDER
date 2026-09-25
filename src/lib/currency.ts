// Currencies a # 마케팅 project can be kept in. Pure data/formatting only, so
// it's safe to import from client components.

export const CURRENCIES = {
  KRW: { label: "원화", unit: "원", symbol: "₩", decimals: 0 },
  JPY: { label: "엔화", unit: "엔", symbol: "¥", decimals: 0 },
  SGD: { label: "싱가포르 달러", unit: "싱가포르 달러", symbol: "S$", decimals: 2 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** Currencies that need a KRW exchange rate (i.e. everything but KRW). */
export const FOREIGN_CURRENCIES = CURRENCY_CODES.filter((c) => c !== "KRW");

/** KRW per 1 unit of each currency. */
export type ExchangeRates = Record<CurrencyCode, number>;

export interface ExchangeRateInfo {
  /** Effective KRW-per-unit rates: manual override if set, otherwise the default. */
  rates: ExchangeRates;
  /** Current-market default rates (what "reset" goes back to). */
  defaults: ExchangeRates;
  /** Currencies whose rate was set manually. */
  overridden: CurrencyCode[];
  /** False when the live API failed and hard-coded fallback defaults are in use. */
  live: boolean;
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}

export function toCurrencyCode(value: string): CurrencyCode {
  return isCurrencyCode(value) ? value : "KRW";
}

export function formatMoney(amount: number, currency: CurrencyCode) {
  if (currency === "KRW") return `${Math.round(amount).toLocaleString("ko-KR")}원`;
  const { symbol, decimals } = CURRENCIES[currency];
  return `${symbol}${amount.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function toKrw(amount: number, currency: CurrencyCode, rates: ExchangeRates) {
  return currency === "KRW" ? amount : amount * rates[currency];
}

/** "≈ 12,345원" helper text for a foreign-currency amount, or null for KRW. */
export function krwHint(amount: number, currency: CurrencyCode, rates: ExchangeRates) {
  if (currency === "KRW" || !Number.isFinite(amount)) return null;
  return `≈ ${formatMoney(toKrw(amount, currency, rates), "KRW")}`;
}

/** Smallest amount step the input accepts for a currency. */
export function amountStep(currency: CurrencyCode) {
  return CURRENCIES[currency].decimals === 0 ? 1 : 10 ** -CURRENCIES[currency].decimals;
}

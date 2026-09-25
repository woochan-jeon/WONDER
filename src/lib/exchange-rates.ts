import "server-only";

import { prisma } from "@/lib/prisma";
import { FOREIGN_CURRENCIES, type CurrencyCode, type ExchangeRateInfo, type ExchangeRates } from "@/lib/currency";

// Used only if the live rate API is unreachable. Rates as of 2026-09-25.
const FALLBACK_RATES: ExchangeRates = { KRW: 1, JPY: 8.63, SGD: 1069.5 };

// Free, keyless, updated daily. Returns units of X per 1 KRW.
const LIVE_RATES_URL = "https://open.er-api.com/v6/latest/KRW";

async function fetchLiveRates(): Promise<{ rates: ExchangeRates; live: boolean }> {
  try {
    const res = await fetch(LIVE_RATES_URL, { next: { revalidate: 60 * 60 * 6 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) throw new Error("unexpected response");
    const rates: ExchangeRates = { ...FALLBACK_RATES };
    for (const c of FOREIGN_CURRENCIES) {
      const perKrw = data.rates[c];
      if (perKrw && perKrw > 0) rates[c] = 1 / perKrw;
    }
    return { rates, live: true };
  } catch (err) {
    console.error("Exchange rate fetch failed, using fallback rates:", err);
    return { rates: FALLBACK_RATES, live: false };
  }
}

export async function getExchangeRates(): Promise<ExchangeRateInfo> {
  const [{ rates: defaults, live }, overrides] = await Promise.all([
    fetchLiveRates(),
    prisma.marketingExchangeRate.findMany(),
  ]);
  const rates = { ...defaults };
  const overridden: CurrencyCode[] = [];
  for (const o of overrides) {
    if ((FOREIGN_CURRENCIES as readonly string[]).includes(o.currency) && o.rate > 0) {
      rates[o.currency as CurrencyCode] = o.rate;
      overridden.push(o.currency as CurrencyCode);
    }
  }
  return { rates, defaults, overridden, live };
}

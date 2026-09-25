// How a # 마케팅 expense hits the books. Kept separate so each can be viewed
// with or without the others — they behave very differently:
//  - CASH: money actually paid out (ad point top-ups, influencer fees, ...).
//  - SALES_DEDUCTION: taken out of sales at settlement (AMS commission, live
//    vouchers) — no money leaves the account, and it scales with sales.
//  - IN_KIND: non-cash cost such as product samples, valued at cost (원가).
// Client-safe (no server imports).

export const EXPENSE_KINDS = ["CASH", "SALES_DEDUCTION", "IN_KIND"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  CASH: "현금성",
  SALES_DEDUCTION: "매출차감형",
  IN_KIND: "현물",
};

/** Stored as the payment method for kinds that don't have a real one, so the column is never blank. */
export const EXPENSE_KIND_PAYMENT_METHOD: Partial<Record<ExpenseKind, string>> = {
  SALES_DEDUCTION: "매출차감",
  IN_KIND: "현물",
};

export function expenseKindFromLabel(label: string): ExpenseKind {
  const trimmed = label.trim();
  if (trimmed === EXPENSE_KIND_LABELS.IN_KIND) return "IN_KIND";
  if (trimmed === EXPENSE_KIND_LABELS.SALES_DEDUCTION) return "SALES_DEDUCTION";
  return "CASH";
}

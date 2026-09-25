"use client";

import Link from "next/link";
import {
  createContext,
  useActionState,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  createCategoryAction,
  createExpenseAction,
  createProjectAction,
  deleteCategoryAction,
  deleteExpenseAction,
  deleteProjectAction,
  resetExchangeRateAction,
  setBudgetAction,
  setExchangeRateAction,
  updateExpenseAction,
  updateProjectCurrencyAction,
  type ActionState,
} from "@/app/(app)/marketing/actions";
import {
  CURRENCIES,
  CURRENCY_CODES,
  FOREIGN_CURRENCIES,
  amountStep,
  formatMoney,
  krwHint,
  toKrw,
  type CurrencyCode,
  type ExchangeRateInfo,
  type ExchangeRates,
} from "@/lib/currency";
import { EXPENSE_KINDS, EXPENSE_KIND_LABELS, type ExpenseKind } from "@/lib/marketing-expense-kind";

type ProjectVM = { id: string; name: string; color: string; currency: CurrencyCode };
type CategoryVM = { id: string; name: string; color: string; projectId: string };
type BudgetVM = { projectId: string; categoryId: string | null; amount: number };
type ExpenseVM = {
  id: string;
  date: string;
  channel: string;
  description: string;
  amount: number;
  kind: ExpenseKind;
  itemName: string | null;
  quantity: number | null;
  unitCost: number | null;
  paymentMethod: string;
  note: string | null;
  projectId: string;
  categoryId: string | null;
};

const PROJECT_COLOR_SWATCHES = [
  "#0066cc",
  "#8D7150",
  "#9D9FA2",
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
];

const initialState: ActionState = {};

const KIND_BADGE_CLASS: Record<ExpenseKind, string> = {
  CASH: "bg-gray-100 text-gray-700",
  SALES_DEDUCTION: "bg-violet-50 text-violet-700",
  IN_KIND: "bg-amber-50 text-amber-700",
};

type KindBreakdown = Partial<Record<ExpenseKind, number>>;

// KRW-per-unit rates, read by every amount display for its "≈ 원" hint.
const RatesContext = createContext<ExchangeRates>({ KRW: 1, JPY: 1, SGD: 1 });

export default function MarketingBoard({
  year,
  month,
  title,
  prevHref,
  nextHref,
  todayHref,
  projects,
  categories,
  budgets,
  expenses: allExpenses,
  channelSuggestions,
  paymentMethodSuggestions,
  exchangeRates,
}: {
  year: number;
  month: number;
  title: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  projects: ProjectVM[];
  categories: CategoryVM[];
  budgets: BudgetVM[];
  expenses: ExpenseVM[];
  channelSuggestions: string[];
  paymentMethodSuggestions: string[];
  exchangeRates: ExchangeRateInfo;
}) {
  const rates = exchangeRates.rates;
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [managingProjects, setManagingProjects] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  // Which expense kinds count toward the totals and list. Everything by
  // default; unchecking e.g. 매출차감형 shows only money actually paid out.
  const [includedKinds, setIncludedKinds] = useState<ReadonlySet<ExpenseKind>>(() => new Set(EXPENSE_KINDS));

  function toggleKind(kind: ExpenseKind) {
    setIncludedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const excludedCounts = EXPENSE_KINDS.filter((k) => !includedKinds.has(k))
    .map((k) => ({ kind: k, count: allExpenses.filter((e) => e.kind === k).length }))
    .filter((x) => x.count > 0);
  const expenses = useMemo(
    () => allExpenses.filter((e) => includedKinds.has(e.kind)),
    [allExpenses, includedKinds],
  );

  function selectProject(id: string | null) {
    setActiveProjectId(id);
    setActiveCategoryId(null);
    setManagingCategories(false);
  }

  const budgetByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of budgets) if (b.categoryId === null) map.set(b.projectId, b.amount);
    return map;
  }, [budgets]);

  const budgetByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of budgets) if (b.categoryId !== null) map.set(b.categoryId, b.amount);
    return map;
  }, [budgets]);

  const spendByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.projectId, (map.get(e.projectId) ?? 0) + e.amount);
    return map;
  }, [expenses]);

  // The overall card mixes projects in different currencies, so it's totaled in KRW.
  const currencyByProject = new Map(projects.map((p) => [p.id, p.currency]));
  const currencyOf = (projectId: string): CurrencyCode => currencyByProject.get(projectId) ?? "KRW";
  const totalBudget = Array.from(budgetByProject.entries()).reduce(
    (sum, [projectId, amount]) => sum + toKrw(amount, currencyOf(projectId), rates),
    0,
  );
  const totalSpend = expenses.reduce((sum, e) => sum + toKrw(e.amount, currencyOf(e.projectId), rates), 0);
  const hasForeignProject = projects.some((p) => p.currency !== "KRW");
  // Per-kind split of each total, shown as a breakdown line under the amount.
  const totalByKind: KindBreakdown = {};
  const byKindByProject = new Map<string, KindBreakdown>();
  for (const e of expenses) {
    totalByKind[e.kind] = (totalByKind[e.kind] ?? 0) + toKrw(e.amount, currencyOf(e.projectId), rates);
    const perProject = byKindByProject.get(e.projectId) ?? {};
    perProject[e.kind] = (perProject[e.kind] ?? 0) + e.amount;
    byKindByProject.set(e.projectId, perProject);
  }
  const activeCurrency = activeProjectId ? currencyOf(activeProjectId) : "KRW";

  const projectExpenses = activeProjectId
    ? expenses.filter((e) => e.projectId === activeProjectId)
    : expenses;

  const categoriesForActiveProject = activeProjectId
    ? categories.filter((c) => c.projectId === activeProjectId)
    : [];

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (!e.categoryId) continue;
      map.set(e.categoryId, (map.get(e.categoryId) ?? 0) + e.amount);
    }
    return map;
  }, [expenses]);

  const visibleExpenses = activeCategoryId
    ? projectExpenses.filter((e) => e.categoryId === activeCategoryId)
    : projectExpenses;

  const editingExpense = editingExpenseId ? allExpenses.find((e) => e.id === editingExpenseId) ?? null : null;

  return (
    <RatesContext.Provider value={rates}>
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-1">
            <Link href={prevHref} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50">
              ‹
            </Link>
            <Link href={todayHref} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50">
              이번 달
            </Link>
            <Link href={nextHref} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-900 hover:bg-gray-50">
              ›
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <fieldset className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm">
            <legend className="sr-only">합계에 포함할 비용 유형</legend>
            {EXPENSE_KINDS.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-1.5 text-gray-700">
                <input
                  type="checkbox"
                  checked={includedKinds.has(k)}
                  onChange={() => toggleKind(k)}
                  className="h-3.5 w-3.5 accent-[#0066cc]"
                />
                {EXPENSE_KIND_LABELS[k]}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={() => setShowExpenseForm((v) => !v)}
            className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3]"
          >
            {showExpenseForm ? "닫기" : "+ 지출 추가"}
          </button>
        </div>
      </div>

      {excludedCounts.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {excludedCounts.map((x) => `${EXPENSE_KIND_LABELS[x.kind]} ${x.count}건`).join(", ")}이 합계와 목록에서 빠져 있습니다.
        </p>
      )}

      {showExpenseForm && (
        <ExpenseForm
          year={year}
          month={month}
          projects={projects}
          categories={categories}
          defaultProjectId={activeProjectId}
          channelSuggestions={channelSuggestions}
          paymentMethodSuggestions={paymentMethodSuggestions}
          onDone={() => setShowExpenseForm(false)}
        />
      )}

      <SummaryCard
        label={hasForeignProject ? "전체 (원화 환산)" : "전체"}
        color="#111827"
        currency="KRW"
        budget={totalBudget}
        spend={totalSpend}
        byKind={totalByKind}
        active={activeProjectId === null}
        onClick={() => selectProject(null)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <ProjectSummary
            key={p.id}
            project={p}
            year={year}
            month={month}
            budget={budgetByProject.get(p.id) ?? null}
            spend={spendByProject.get(p.id) ?? 0}
            byKind={byKindByProject.get(p.id) ?? {}}
            categories={categories}
            spendByCategory={spendByCategory}
            budgetByCategory={budgetByCategory}
            active={activeProjectId === p.id}
            onClick={() => selectProject(p.id)}
          />
        ))}
      </div>

      {activeProjectId && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">카테고리별 예산 · 지출</p>
            <button
              type="button"
              onClick={() => setManagingCategories((v) => !v)}
              className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
            >
              카테고리 관리
            </button>
          </div>
          <CategoryChip
            label="전체"
            color="#111827"
            amount={projectExpenses.reduce((sum, e) => sum + e.amount, 0)}
            currency={activeCurrency}
            active={activeCategoryId === null}
            onClick={() => setActiveCategoryId(null)}
          />
          {categoriesForActiveProject.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {categoriesForActiveProject.map((c) => (
                <CategorySummary
                  key={c.id}
                  category={c}
                  currency={activeCurrency}
                  projectId={activeProjectId}
                  year={year}
                  month={month}
                  budget={budgetByCategory.get(c.id) ?? null}
                  spend={spendByCategory.get(c.id) ?? 0}
                  active={activeCategoryId === c.id}
                  onClick={() => setActiveCategoryId(c.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">등록된 카테고리가 없습니다.</p>
          )}
          {managingCategories && (
            <CategoryManagePanel projectId={activeProjectId} categories={categoriesForActiveProject} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {activeProjectId ? projects.find((p) => p.id === activeProjectId)?.name : "전체"}
          {activeCategoryId ? ` · ${categoriesForActiveProject.find((c) => c.id === activeCategoryId)?.name}` : ""} ·{" "}
          {visibleExpenses.length}건
        </p>
        <button
          type="button"
          onClick={() => setManagingProjects((v) => !v)}
          className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          프로젝트 관리
        </button>
      </div>

      {managingProjects && <ProjectManagePanel projects={projects} exchangeRates={exchangeRates} />}

      <ExpenseTable
        expenses={visibleExpenses}
        projects={projects}
        categories={categories}
        onEdit={setEditingExpenseId}
      />

      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          projects={projects}
          categories={categories}
          channelSuggestions={channelSuggestions}
          paymentMethodSuggestions={paymentMethodSuggestions}
          onClose={() => setEditingExpenseId(null)}
        />
      )}
    </div>
    </RatesContext.Provider>
  );
}

function SummaryCard({
  label,
  color,
  currency,
  budget,
  spend,
  byKind,
  active,
  onClick,
  children,
}: {
  label: string;
  color: string;
  currency: CurrencyCode;
  budget: number;
  spend: number;
  byKind?: KindBreakdown;
  active: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  const rates = useContext(RatesContext);
  const hasBudget = budget > 0;
  const pct = hasBudget ? Math.round((spend / budget) * 100) : null;
  const over = hasBudget && spend > budget;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${
        active ? "border-[#0066cc] bg-[#0066cc]/5" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {label}
        </span>
        {pct !== null && (
          <span className={`text-xs font-medium ${over ? "text-red-600" : "text-gray-500"}`}>{pct}%</span>
        )}
      </div>
      <p className="text-lg font-semibold text-gray-900">
        {formatMoney(spend, currency)}
        {hasBudget && <span className="ml-1 text-xs font-normal text-gray-400">/ {formatMoney(budget, currency)}</span>}
      </p>
      {currency !== "KRW" && (
        <p className="-mt-1 text-xs text-gray-400">
          {krwHint(spend, currency, rates)}
          {hasBudget && ` / ${formatMoney(toKrw(budget, currency, rates), "KRW")}`}
        </p>
      )}
      {byKind && Object.keys(byKind).length > 1 && (
        <p className="-mt-1 text-xs text-gray-500">
          {EXPENSE_KINDS.filter((k) => byKind[k])
            .map((k) => `${EXPENSE_KIND_LABELS[k]} ${formatMoney(byKind[k]!, currency)}`)
            .join(" · ")}
        </p>
      )}
      {hasBudget && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${over ? "bg-red-500" : "bg-[#0066cc]"}`}
            style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
          />
        </div>
      )}
      {hasBudget && (
        <p className={`text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
          {over ? `${formatMoney(spend - budget, currency)} 초과` : `${formatMoney(budget - spend, currency)} 남음`}
        </p>
      )}
      {children}
    </button>
  );
}

function ProjectSummary({
  project,
  year,
  month,
  budget,
  spend,
  byKind,
  categories,
  spendByCategory,
  budgetByCategory,
  active,
  onClick,
}: {
  project: ProjectVM;
  year: number;
  month: number;
  budget: number | null;
  spend: number;
  byKind: KindBreakdown;
  categories: CategoryVM[];
  spendByCategory: Map<string, number>;
  budgetByCategory: Map<string, number>;
  active: boolean;
  onClick: () => void;
}) {
  const [editingBudget, setEditingBudget] = useState(false);
  const projectCategories = categories.filter((c) => c.projectId === project.id);

  return (
    <div className="flex flex-col gap-1.5">
      <SummaryCard
        label={project.currency === "KRW" ? project.name : `${project.name} · ${CURRENCIES[project.currency].label}`}
        color={project.color}
        currency={project.currency}
        budget={budget ?? 0}
        spend={spend}
        byKind={byKind}
        active={active}
        onClick={onClick}
      >
        {projectCategories.length > 0 && (
          <div className="flex flex-col gap-0.5 border-t border-gray-100 pt-1.5">
            {projectCategories.map((c) => {
              const categoryBudget = budgetByCategory.get(c.id) ?? 0;
              return (
                <div key={c.id} className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                    {c.name}
                  </span>
                  <span>
                    {formatMoney(spendByCategory.get(c.id) ?? 0, project.currency)}
                    {categoryBudget > 0 && (
                      <span className="text-gray-400"> / {formatMoney(categoryBudget, project.currency)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SummaryCard>
      {editingBudget ? (
        <BudgetForm
          projectId={project.id}
          currency={project.currency}
          categoryId={null}
          year={year}
          month={month}
          defaultAmount={budget}
          onDone={() => setEditingBudget(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingBudget(true)}
          className="self-start px-1 text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          {budget !== null ? "목표 예산 수정" : "목표 예산 설정"}
        </button>
      )}
    </div>
  );
}

function BudgetForm({
  projectId,
  currency,
  categoryId,
  year,
  month,
  defaultAmount,
  onDone,
}: {
  projectId: string;
  currency: CurrencyCode;
  categoryId: string | null;
  year: number;
  month: number;
  defaultAmount: number | null;
  onDone: () => void;
}) {
  const rates = useContext(RatesContext);
  const [amount, setAmount] = useState(defaultAmount !== null ? String(defaultAmount) : "");
  const hint = amount === "" ? null : krwHint(Number(amount), currency, rates);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await setBudgetAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="projectId" value={projectId} />
      {categoryId && <input type="hidden" name="categoryId" value={categoryId} />}
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <input
        name="amount"
        type="number"
        min={0}
        step={amountStep(currency)}
        autoFocus
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`목표 예산(${CURRENCIES[currency].unit})`}
        className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#0066cc] px-2 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60"
      >
        저장
      </button>
      <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:text-gray-700">
        취소
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function CategorySummary({
  category,
  currency,
  projectId,
  year,
  month,
  budget,
  spend,
  active,
  onClick,
}: {
  category: CategoryVM;
  currency: CurrencyCode;
  projectId: string;
  year: number;
  month: number;
  budget: number | null;
  spend: number;
  active: boolean;
  onClick: () => void;
}) {
  const [editingBudget, setEditingBudget] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <SummaryCard label={category.name} color={category.color} currency={currency} budget={budget ?? 0} spend={spend} active={active} onClick={onClick} />
      {editingBudget ? (
        <BudgetForm
          projectId={projectId}
          currency={currency}
          categoryId={category.id}
          year={year}
          month={month}
          defaultAmount={budget}
          onDone={() => setEditingBudget(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingBudget(true)}
          className="self-start px-1 text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          {budget !== null ? "목표 예산 수정" : "목표 예산 설정"}
        </button>
      )}
    </div>
  );
}

function ProjectManagePanel({ projects, exchangeRates }: { projects: ProjectVM[]; exchangeRates: ExchangeRateInfo }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState(PROJECT_COLOR_SWATCHES[0]);
  const [currency, setCurrency] = useState<CurrencyCode>("KRW");
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createProjectAction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <span key={p.id} className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
            {p.name}
            <select
              value={p.currency}
              aria-label={`${p.name} 통화`}
              onChange={(e) => {
                const next = e.target.value as CurrencyCode;
                if (
                  confirm(
                    `"${p.name}" 프로젝트의 통화를 ${CURRENCIES[next].label}(으)로 바꿀까요? 이미 입력한 예산/지출 금액은 숫자 그대로 두고 단위만 바뀝니다.`,
                  )
                ) {
                  startTransition(() => updateProjectCurrencyAction(p.id, next));
                }
              }}
              className="rounded border-none bg-transparent py-0 pr-5 pl-1 text-xs text-gray-500 outline-none hover:bg-gray-50"
            >
              {CURRENCY_CODES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCIES[c].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (confirm(`"${p.name}" 프로젝트를 삭제할까요? 관련 예산/지출 기록도 함께 삭제됩니다.`)) {
                  startTransition(() => deleteProjectAction(p.id));
                }
              }}
              title={`${p.name} 삭제`}
              aria-label={`${p.name} 삭제`}
              className="text-gray-400 hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="color" value={color} />
        <input
          name="name"
          placeholder="새 프로젝트 이름 (예: 큐텐, 쇼피)"
          required
          className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <select
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          aria-label="통화"
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        >
          {CURRENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {CURRENCIES[c].label} ({c})
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {PROJECT_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              title={swatch}
              style={{ backgroundColor: swatch }}
              className={`h-5 w-5 rounded-full ${color === swatch ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0066cc] px-2.5 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60"
        >
          추가
        </button>
      </form>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex flex-col gap-1.5 border-t border-gray-200 pt-2">
        <p className="text-xs font-medium text-gray-500">
          환율 (원화 환산 표시에 사용)
          {!exchangeRates.live && (
            <span className="ml-1 font-normal text-amber-700">· 실시간 환율을 불러오지 못해 저장된 기본값을 사용 중</span>
          )}
        </p>
        {FOREIGN_CURRENCIES.map((c) => (
          <ExchangeRateRow
            key={`${c}-${exchangeRates.rates[c]}`}
            currency={c}
            rate={exchangeRates.rates[c]}
            defaultRate={exchangeRates.defaults[c]}
            overridden={exchangeRates.overridden.includes(c)}
          />
        ))}
      </div>
    </div>
  );
}

function formatRate(rate: number) {
  return rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function ExchangeRateRow({
  currency,
  rate,
  defaultRate,
  overridden,
}: {
  currency: CurrencyCode;
  rate: number;
  defaultRate: number;
  overridden: boolean;
}) {
  const [resetting, startReset] = useTransition();
  const [state, formAction, pending] = useActionState(setExchangeRateAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
      <input type="hidden" name="currency" value={currency} />
      <span className="w-32">
        1 {CURRENCIES[currency].unit} ({currency}) =
      </span>
      <input
        name="rate"
        type="number"
        min={0}
        step="any"
        required
        defaultValue={Math.round(rate * 100) / 100}
        aria-label={`${CURRENCIES[currency].label} 환율`}
        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      <span>원</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#0066cc] px-2 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60"
      >
        저장
      </button>
      {overridden ? (
        <>
          <span className="text-amber-700">직접 입력한 값</span>
          <button
            type="button"
            disabled={resetting}
            onClick={() => startReset(() => resetExchangeRateAction(currency))}
            className="text-gray-500 underline decoration-dotted hover:text-gray-700 disabled:opacity-60"
          >
            현재 환율({formatRate(defaultRate)}원)로 되돌리기
          </button>
        </>
      ) : (
        <span className="text-gray-400">현재 환율 기준</span>
      )}
      {state.error && <span className="text-red-600">{state.error}</span>}
    </form>
  );
}

function CategoryChip({
  label,
  color,
  amount,
  currency,
  active,
  onClick,
}: {
  label: string;
  color: string;
  amount: number;
  currency: CurrencyCode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-[#0066cc] bg-[#0066cc]/10 text-[#0066cc]" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
      <span className="text-gray-400">{formatMoney(amount, currency)}</span>
    </button>
  );
}

function CategoryManagePanel({ projectId, categories }: { projectId: string; categories: CategoryVM[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [color, setColor] = useState(PROJECT_COLOR_SWATCHES[0]);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createCategoryAction(prev, formData);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
            {c.name}
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `"${c.name}" 카테고리를 삭제할까요? 관련 지출 기록의 카테고리는 비워지고, 이 카테고리에 설정된 예산은 함께 삭제됩니다.`,
                  )
                ) {
                  startTransition(() => deleteCategoryAction(c.id));
                }
              }}
              title={`${c.name} 삭제`}
              aria-label={`${c.name} 삭제`}
              className="text-gray-400 hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="color" value={color} />
        <input
          name="name"
          placeholder="새 카테고리 이름 (예: 광고비, 인플루언서)"
          required
          className="w-48 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <div className="flex items-center gap-1">
          {PROJECT_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              title={swatch}
              style={{ backgroundColor: swatch }}
              className={`h-5 w-5 rounded-full ${color === swatch ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0066cc] px-2.5 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60"
        >
          추가
        </button>
      </form>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}

function ProjectSelect({
  projects,
  value,
  defaultValue,
  onChange,
  className,
}: {
  projects: ProjectVM[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className: string;
}) {
  const controlledProps = onChange
    ? { value: value ?? "", onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) }
    : { defaultValue: defaultValue ?? "" };
  return (
    <select name="projectId" required className={className} {...controlledProps}>
      <option value="" disabled>
        프로젝트 선택
      </option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({
  categories,
  value,
  defaultValue,
  onChange,
  className,
}: {
  categories: CategoryVM[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className: string;
}) {
  const controlledProps = onChange
    ? { value: value ?? "", onChange: (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) }
    : { defaultValue: defaultValue ?? "" };
  return (
    <select name="categoryId" disabled={categories.length === 0} className={className} {...controlledProps}>
      <option value="">{categories.length === 0 ? "카테고리 없음" : "카테고리 선택 안 함"}</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Amount field in the selected project's currency; for foreign currencies the
// KRW equivalent is shown live beside it.
function AmountInput({ currency, defaultValue }: { currency: CurrencyCode; defaultValue?: number }) {
  const rates = useContext(RatesContext);
  const [value, setValue] = useState(defaultValue !== undefined ? String(defaultValue) : "");
  const hint = value === "" ? null : krwHint(Number(value), currency, rates);

  return (
    <div className="flex items-center gap-2">
      <input
        name="amount"
        type="number"
        min={0}
        step={amountStep(currency)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`비용(${CURRENCIES[currency].unit}) *`}
        required
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      {currency !== "KRW" && (
        <span className="shrink-0 text-xs text-gray-500">
          {hint ?? `1 ${CURRENCIES[currency].unit} = ${formatRate(rates[currency])}원`}
        </span>
      )}
    </div>
  );
}

// 현금 vs 현물 cost entry. Cash takes a payment method and amount; in-kind
// (e.g. product samples) takes item × quantity × unit cost (원가), and the
// server stores their product as the amount.
function CostFields({
  currency,
  paymentListId,
  expense,
}: {
  currency: CurrencyCode;
  paymentListId: string;
  expense?: ExpenseVM;
}) {
  const rates = useContext(RatesContext);
  const [kind, setKind] = useState<ExpenseKind>(expense?.kind ?? "CASH");
  const [quantity, setQuantity] = useState(expense?.quantity != null ? String(expense.quantity) : "");
  const [unitCost, setUnitCost] = useState(expense?.unitCost != null ? String(expense.unitCost) : "");
  const total = quantity !== "" && unitCost !== "" ? Number(quantity) * Number(unitCost) : null;
  const totalHint = total !== null && Number.isFinite(total) ? krwHint(total, currency, rates) : null;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex items-center gap-1 self-start rounded-md border border-gray-200 bg-white p-0.5 text-xs">
        {(
          [
            ["CASH", "현금성"],
            ["SALES_DEDUCTION", "매출차감형"],
            ["IN_KIND", "현물 (샘플 등)"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`rounded px-2.5 py-1 ${kind === value ? "bg-[#0066cc] text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {kind === "CASH"
          ? "실제로 돈이 나가는 비용 (포인트 충전, 인플루언서, 광고비 등). 포인트는 충전 시점에 기록하고, 다음 달로 이월되면 소진 기준으로 나눠 기록하세요."
          : kind === "SALES_DEDUCTION"
            ? "정산 때 매출에서 빠지는 비용 (AMS 수수료, 라이브 바우처 등). 정산 금액이 확정되면 기록하세요."
            : "제품 샘플 등 현물 제공 비용. 원가 기준으로 계산됩니다."}
      </p>
      {kind === "SALES_DEDUCTION" ? (
        <AmountInput
          currency={currency}
          defaultValue={expense?.kind === "SALES_DEDUCTION" ? expense.amount : undefined}
        />
      ) : kind === "CASH" ? (
        <>
          <input
            name="paymentMethod"
            list={paymentListId}
            defaultValue={expense?.kind === "CASH" ? expense.paymentMethod : undefined}
            placeholder="지출 방식 (예: 법인카드) *"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
          <AmountInput currency={currency} defaultValue={expense?.kind === "CASH" ? expense.amount : undefined} />
        </>
      ) : (
        <>
          <input
            name="itemName"
            defaultValue={expense?.itemName ?? undefined}
            placeholder="품목 (예: 스킨케어 샘플 세트) *"
            required
            maxLength={100}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="quantity"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="수량 *"
              required
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
            />
            <span className="text-sm text-gray-400">×</span>
            <input
              name="unitCost"
              type="number"
              min={0}
              step={amountStep(currency)}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder={`개당 원가(${CURRENCIES[currency].unit}) *`}
              required
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
            />
          </div>
          <p className="text-xs text-gray-500">
            {total !== null && Number.isFinite(total) ? (
              <>
                합계 <span className="font-medium text-gray-900">{formatMoney(total, currency)}</span>
                {totalHint && ` (${totalHint})`} · 원가 기준
              </>
            ) : (
              "수량과 개당 원가를 입력하면 합계가 자동 계산됩니다 (원가 기준)."
            )}
          </p>
        </>
      )}
    </div>
  );
}

function ExpenseForm({
  year,
  month,
  projects,
  categories,
  defaultProjectId,
  channelSuggestions,
  paymentMethodSuggestions,
  onDone,
}: {
  year: number;
  month: number;
  projects: ProjectVM[];
  categories: CategoryVM[];
  defaultProjectId: string | null;
  channelSuggestions: string[];
  paymentMethodSuggestions: string[];
  onDone: () => void;
}) {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const defaultDate = isCurrentMonth
    ? todayKey()
    : `${year}-${String(month).padStart(2, "0")}-01`;

  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? "");
  const categoriesForProject = categories.filter((c) => c.projectId === selectedProjectId);

  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createExpenseAction(prev, formData);
    if (!result.error) onDone();
    return result;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap gap-2">
        <ProjectSelect
          projects={projects}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <CategorySelect
          key={selectedProjectId}
          categories={categoriesForProject}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <input
          name="date"
          type="date"
          defaultValue={defaultDate}
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          name="channel"
          list="marketing-channel-suggestions"
          placeholder="채널 (예: 페이스북 광고, 인플루언서) *"
          required
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
      </div>
      <textarea
        name="description"
        placeholder="어떤 마케팅을 진행했는지 *"
        required
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      <CostFields
        currency={projects.find((p) => p.id === selectedProjectId)?.currency ?? "KRW"}
        paymentListId="marketing-payment-suggestions"
      />
      <textarea
        name="note"
        placeholder="비고 (선택)"
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
        >
          {pending ? "저장 중..." : "추가"}
        </button>
      </div>
      <datalist id="marketing-channel-suggestions">
        {channelSuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="marketing-payment-suggestions">
        {paymentMethodSuggestions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </form>
  );
}

function ExpenseTable({
  expenses,
  projects,
  categories,
  onEdit,
}: {
  expenses: ExpenseVM[];
  projects: ProjectVM[];
  categories: CategoryVM[];
  onEdit: (id: string) => void;
}) {
  const rates = useContext(RatesContext);
  const [, startTransition] = useTransition();
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  if (expenses.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-200 p-4 text-center text-xs text-gray-900">
        지출 내역 없음
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-medium text-gray-500">
            <th className="px-3 py-2">날짜</th>
            <th className="px-3 py-2">프로젝트</th>
            <th className="px-3 py-2">카테고리</th>
            <th className="px-3 py-2">채널</th>
            <th className="px-3 py-2">내용</th>
            <th className="px-3 py-2 text-right">비용</th>
            <th className="px-3 py-2">지출 방식</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {expenses.map((e) => {
            const project = projectById.get(e.projectId);
            const category = e.categoryId ? categoryById.get(e.categoryId) : null;
            return (
              <tr key={e.id} className="align-top hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-900">{e.date}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {project && (
                    <span className="flex items-center gap-1.5 text-gray-900">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
                      {project.name}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {category ? (
                    <span className="flex items-center gap-1.5 text-gray-900">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} aria-hidden />
                      {category.name}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-900">{e.channel}</td>
                <td className="max-w-xs px-3 py-2 text-gray-900">
                  <p>{e.description}</p>
                  {e.kind === "IN_KIND" && e.itemName && (
                    <p className="mt-0.5 text-xs text-gray-600">
                      {e.itemName} × {e.quantity?.toLocaleString("ko-KR")}개
                      {e.unitCost != null && ` (개당 ${formatMoney(e.unitCost, project?.currency ?? "KRW")})`}
                    </p>
                  )}
                  {e.note && <p className="mt-0.5 text-xs text-gray-500">{e.note}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-900">
                  {formatMoney(e.amount, project?.currency ?? "KRW")}
                  {project && project.currency !== "KRW" && (
                    <p className="text-xs font-normal text-gray-400">{krwHint(e.amount, project.currency, rates)}</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-900">
                  {e.kind === "CASH" ? (
                    e.paymentMethod
                  ) : (
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${KIND_BADGE_CLASS[e.kind]}`}>
                      {EXPENSE_KIND_LABELS[e.kind]}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    onClick={() => onEdit(e.id)}
                    title="수정"
                    className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("이 지출 항목을 삭제할까요?")) {
                        startTransition(() => deleteExpenseAction(e.id));
                      }
                    }}
                    title="삭제"
                    className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseEditModal({
  expense,
  projects,
  categories,
  channelSuggestions,
  paymentMethodSuggestions,
  onClose,
}: {
  expense: ExpenseVM;
  projects: ProjectVM[];
  categories: CategoryVM[];
  channelSuggestions: string[];
  paymentMethodSuggestions: string[];
  onClose: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(expense.projectId);
  const categoriesForProject = categories.filter((c) => c.projectId === selectedProjectId);

  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updateExpenseAction(prev, formData);
    if (!result.error) onClose();
    return result;
  }, initialState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden />
      <form action={formAction} className="relative z-10 flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">지출 항목 수정</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
            ✕
          </button>
        </div>
        <input type="hidden" name="expenseId" value={expense.id} />
        <div className="flex flex-wrap gap-2">
          <ProjectSelect
            projects={projects}
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
          <CategorySelect
            key={selectedProjectId}
            categories={categoriesForProject}
            defaultValue={selectedProjectId === expense.projectId ? (expense.categoryId ?? "") : ""}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
          <input
            name="date"
            type="date"
            defaultValue={expense.date}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            name="channel"
            list="marketing-channel-suggestions-edit"
            defaultValue={expense.channel}
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
          />
        </div>
        <textarea
          name="description"
          defaultValue={expense.description}
          required
          rows={2}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        <CostFields
          currency={projects.find((p) => p.id === selectedProjectId)?.currency ?? "KRW"}
          paymentListId="marketing-payment-suggestions-edit"
          expense={expense}
        />
        <textarea
          name="note"
          defaultValue={expense.note ?? ""}
          placeholder="비고 (선택)"
          rows={2}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
        <datalist id="marketing-channel-suggestions-edit">
          {channelSuggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="marketing-payment-suggestions-edit">
          {paymentMethodSuggestions.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </form>
    </div>
  );
}

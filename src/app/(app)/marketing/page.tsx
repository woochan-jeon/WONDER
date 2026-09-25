import ChannelHeader from "@/components/channel-header";
import MarketingBoard from "@/components/marketing-board";
import { prisma } from "@/lib/prisma";
import { monthParam, parseMonthParam, shiftMonth, toDateKey } from "@/lib/calendar-grid";
import { getConnectionStatus, isGoogleOAuthConfigured } from "@/lib/google-calendar";
import { SheetsScopeError, getMarketingSheetUrl, syncMarketingSheet } from "@/lib/google-sheets";
import { toCurrencyCode } from "@/lib/currency";
import { getExchangeRates } from "@/lib/exchange-rates";

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month); // month is 0-indexed
  const calendarMonth = month + 1;

  const rangeStart = new Date(year, month, 1);
  const rangeEndExclusive = new Date(year, month + 1, 1);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const prevHref = `/marketing?month=${monthParam(prev.year, prev.month)}`;
  const nextHref = `/marketing?month=${monthParam(next.year, next.month)}`;
  const todayHref = `/marketing`;
  const title = rangeStart.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  const status = await getConnectionStatus();
  const oauthConfigured = isGoogleOAuthConfigured();
  let sheetUrl: string | null = null;
  let sheetScopeError = false;
  if (status.connected) {
    try {
      // Pulls in any edits made directly in the sheet, then pushes the
      // current DB state back — see syncMarketingSheet for the sync rules.
      sheetUrl = await syncMarketingSheet();
    } catch (err) {
      if (err instanceof SheetsScopeError) {
        sheetScopeError = true;
        sheetUrl = await getMarketingSheetUrl();
      } else {
        throw err;
      }
    }
  }

  const [exchangeRates, projects, categories, budgets, expenseRows, channelRows, paymentMethodRows] = await Promise.all([
    getExchangeRates(),
    prisma.marketingProject.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.marketingCategory.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.marketingBudget.findMany({ where: { year, month: calendarMonth } }),
    prisma.marketingExpense.findMany({
      where: { date: { gte: rangeStart, lt: rangeEndExclusive } },
      include: { project: true },
      orderBy: { date: "desc" },
    }),
    prisma.marketingExpense.findMany({
      distinct: ["channel"],
      select: { channel: true },
      orderBy: { channel: "asc" },
    }),
    prisma.marketingExpense.findMany({
      distinct: ["paymentMethod"],
      select: { paymentMethod: true },
      orderBy: { paymentMethod: "asc" },
    }),
  ]);

  const expenses = expenseRows.map((e) => ({
    id: e.id,
    date: toDateKey(e.date),
    channel: e.channel,
    description: e.description,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    note: e.note,
    projectId: e.projectId,
    categoryId: e.categoryId,
  }));

  return (
    <>
      <ChannelHeader
        icon="📊"
        title="마케팅"
        description="월별 채널별 마케팅 진행 현황과 예산 집행 내역을 관리하는 채널"
        action={
          sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50"
            >
              구글 시트에서 열기 →
            </a>
          ) : oauthConfigured ? (
            <a
              href="/api/calendar/oauth/start"
              className="rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3]"
            >
              {status.connected ? "구글 계정 다시 연결" : "구글 계정 연결"}
            </a>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {!status.connected ? (
          <p className="mb-4 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            구글 시트 연동을 사용하려면 캘린더 채널과 같은 구글 계정 연결이 필요합니다.{" "}
            {oauthConfigured ? (
              <a href="/api/calendar/oauth/start" className="font-medium text-[#0066cc] hover:underline">
                구글 계정 연결하기
              </a>
            ) : (
              "README의 안내에 따라 Google Cloud OAuth 설정을 먼저 완료해 주세요."
            )}
          </p>
        ) : sheetScopeError ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            연결된 구글 계정에 시트 접근 권한이 없습니다. 시트 연동이 추가되기 전에 연결된 계정이라면 재연결하면
            시트 접근 동의가 함께 요청됩니다. →{" "}
            <a href="/api/calendar/oauth/start" className="font-medium underline">
              구글 계정 다시 연결하기
            </a>
          </p>
        ) : null}
        <MarketingBoard
          year={year}
          month={calendarMonth}
          title={title}
          prevHref={prevHref}
          nextHref={nextHref}
          todayHref={todayHref}
          projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color, currency: toCurrencyCode(p.currency) }))}
          exchangeRates={exchangeRates}
          categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color, projectId: c.projectId }))}
          budgets={budgets.map((b) => ({ projectId: b.projectId, categoryId: b.categoryId, amount: b.amount }))}
          expenses={expenses}
          channelSuggestions={channelRows.map((c) => c.channel)}
          paymentMethodSuggestions={paymentMethodRows.map((p) => p.paymentMethod)}
        />
      </div>
    </>
  );
}

import ChannelHeader from "@/components/channel-header";
import CalendarMonthGrid from "@/components/calendar-month-grid";
import { CalendarPicker, NewEventButton } from "@/components/calendar-toolbar";
import {
  getCalendarColors,
  getConnectionStatus,
  isGoogleOAuthConfigured,
  listCalendars,
  listEventsInRange,
} from "@/lib/google-calendar";
import { getMonthGrid, parseMonthParam } from "@/lib/calendar-grid";
import { disconnectCalendarAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "구글 인증에 실패했습니다. 다시 시도해 주세요.",
  token_exchange_failed: "구글과 연결하는 중 오류가 발생했습니다. 다시 시도해 주세요.",
  access_denied: "구글 로그인에서 접근을 거부했습니다.",
  not_configured: "아직 Google Cloud OAuth 설정이 완료되지 않았습니다. README를 참고해 설정해 주세요.",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; month?: string }>;
}) {
  const params = await searchParams;
  const status = await getConnectionStatus();
  const oauthConfigured = isGoogleOAuthConfigured();
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "알 수 없는 오류가 발생했습니다." : null;

  const { year, month } = parseMonthParam(params.month);
  const { gridStart, gridEnd } = getMonthGrid(year, month);
  const gridEndExclusive = new Date(gridEnd);
  gridEndExclusive.setDate(gridEndExclusive.getDate() + 1);

  const [events, calendars, calendarColors] = await Promise.all([
    status.connected ? listEventsInRange(gridStart, gridEndExclusive) : Promise.resolve([]),
    status.connected ? listCalendars() : Promise.resolve([]),
    status.connected ? getCalendarColors() : Promise.resolve({}),
  ]);

  return (
    <>
      <ChannelHeader
        icon="📅"
        title="캘린더"
        description="구글 캘린더와 연동된 팀 일정"
        action={
          status.connected ? (
            <form action={disconnectCalendarAction}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                연결 해제
              </button>
            </form>
          ) : oauthConfigured ? (
            <a
              href="/api/calendar/oauth/start"
              className="rounded-md bg-[#002D56] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00203C]"
            >
              구글 캘린더 연결
            </a>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {errorMessage && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        )}

        {!status.connected ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-600">아직 팀 구글 캘린더가 연결되지 않았습니다.</p>
            {oauthConfigured ? (
              <a
                href="/api/calendar/oauth/start"
                className="mt-2 rounded-md bg-[#002D56] px-4 py-2 text-sm font-medium text-white hover:bg-[#00203C]"
              >
                구글 캘린더 연결하기
              </a>
            ) : (
              <p className="text-xs text-gray-400">
                README의 안내에 따라 Google Cloud OAuth 설정을 먼저 완료해 주세요.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-400">{status.googleEmail} 계정으로 연결됨</p>
              <CalendarPicker calendars={calendars} currentCalendarIds={status.calendarIds} />
            </div>
            <div className="mb-4">
              <NewEventButton />
            </div>
            <CalendarMonthGrid year={year} month={month} events={events} calendarColors={calendarColors} />
          </>
        )}
      </div>
    </>
  );
}

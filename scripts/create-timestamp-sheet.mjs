// One-off: creates the "WONDER 타임스탬프" Google Sheet (tabs 팀전 / 제니홍 / 페네핏)
// in the connected team Google account, seeded from the original "02. timeline"
// sheet (팀 전시회 → 팀전, 전자상거래 → 제니홍). Prints the new spreadsheet ID,
// which goes into TIMESTAMP_SHEET_ID in src/lib/timestamp-sheet.ts.
//
//   node scripts/create-timestamp-sheet.mjs
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { google } from "googleapis";

const HEADER = ["날짜(YYYY-MM-DD)", "내용", "비고"];

const TABS = {
  팀전: [
    ["2026-02-10", "업체 리스팅 시작", ""],
    ["2026-02-19", "리스팅 완료", "약 340개의 협력업체 리스트업 완료"],
    ["2026-02-23", "콜드메일 발송", "회신율 15%(업체 50곳) 달성"],
    ["2026-03-04", "첫 업체 미팅", "미팅을 진행한 모든 업체에서 MOU에 대한 긍정적 의사 표시"],
    ["2026-03-12", "업체 미팅 완료", ""],
    ["2026-03-18", "MOU 체결 완료", "제이엠유니텍, 에이엠에이엔"],
    ["2026-03-21", "항공권 결제 완료", ""],
    ["2026-03-25", "매칭비 입금 완료", ""],
    ["2026-04-15", "팀전시회 숙소예약 완료", ""],
    ["2026-05-12", "부스비 납부", "사업단"],
    ["2026-05-21", "부스비 잔금납부", "매칭비"],
    ["2026-05-31", "메가주 참관", ""],
    ["2026-06-05", "부스 물품추가", "캐비넷, 상담테이블, 의자, 조명"],
    ["2026-06-10", "팀전시회 중간보고", ""],
    ["2026-06-22", "링크드인 리스팅 시작", ""],
    ["2026-06-27", "백월 디자인 시작", ""],
    ["2026-07-02", "포스기 렌탈", ""],
    ["2026-07-03", "카탈로그 주문", ""],
    ["2026-07-04", "상담조건 논의", ""],
    ["2026-07-04", "팀복 제작", "마플스토어"],
    ["2026-07-05", "제품소개영상 제작완료", "제미나이"],
    ["2026-07-05", "백월 샘플 주문", "6장 중 한장 시험프린트"],
    ["2026-07-10", "보도기사 배포완료", "뉴스와이어, vrtimes"],
    ["2026-07-13", "굿즈 제작", "스티커, 키링"],
    ["2026-07-14", "전시회 샘플 출고", "DGF"],
  ],
  제니홍: [
    ["2026-03-25", "MOU 체결완료", "닥터스쿡"],
    ["2026-05-11", "가격설정 완료", ""],
    ["2026-05-13", "물류사 계약체결", "현대글로비스"],
    ["2026-05-15", "고비즈사업 신청", ""],
    ["2026-05-25", "인스타그램 계정 개설", ""],
    ["2026-06-22", "큐텐 샘플마켓 신청", "30건"],
    ["2026-06-24", "MOU 재체결", "닥터스웰(판매법인)"],
    ["2026-07-09", "아메바 계정 개설", ""],
    ["2026-07-10", "라인 비즈니스 계정 개설", ""],
    ["2026-07-11", "X 계정 개설", ""],
  ],
  페네핏: [],
};

const sql = neon(process.env.DATABASE_URL);
const [connection] = await sql`select "refreshToken" from "CalendarConnection" limit 1`;
if (!connection) throw new Error("No Google account is connected (# 캘린더 channel).");

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);
auth.setCredentials({ refresh_token: connection.refreshToken });
const sheets = google.sheets({ version: "v4", auth });

const { data } = await sheets.spreadsheets.create({
  requestBody: {
    properties: { title: "WONDER 타임스탬프", locale: "ko_KR", timeZone: "Asia/Seoul" },
    sheets: Object.keys(TABS).map((title) => ({ properties: { title, gridProperties: { frozenRowCount: 1 } } })),
  },
});
const spreadsheetId = data.spreadsheetId;

// Plain-text cells so dates stay "YYYY-MM-DD" instead of turning into serial dates.
await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: {
    requests: (data.sheets ?? []).flatMap((sheet) => [
      {
        repeatCell: {
          range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 2000, startColumnIndex: 0, endColumnIndex: 3 },
          cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      },
      {
        repeatCell: {
          range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: "userEnteredFormat.textFormat.bold",
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: sheet.properties.sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 3 },
          properties: { pixelSize: 280 },
          fields: "pixelSize",
        },
      },
    ]),
  },
});

await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: {
    valueInputOption: "RAW",
    data: Object.entries(TABS).map(([title, rows]) => ({ range: `'${title}'!A1`, values: [HEADER, ...rows] })),
  },
});

console.log(spreadsheetId);
console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

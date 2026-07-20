import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Each item pairs one agenda point directly with the decision (or ongoing
// status) reached on it, in the order discussed during the meeting.
const meetings = [
  {
    driveFileId: "1FJMP7OLL8_0XfWf8JR2YVYu3px_AMtvp-t1UJ3X9q3U",
    meetingDate: "2026-07-15T12:24:00+09:00",
    title: "2026년 7월 15일의 회의록",
    items: [
      {
        agenda: "큐텐 내부 광고(파워랭크업/스마트세일즈/메가AD) 운영 현황 공유",
        decision: null,
      },
      {
        agenda: "마케팅 보고 체계(주간/월간) 개선안",
        decision: "매주 월요일 마케팅 분석 보고서 제출, 매달 셋째 주 수요일 예산안 사전 승인 체계 도입",
      },
      {
        agenda: "마케팅 활동비 운용 방식",
        decision: "마케팅 활동비 50만 원을 담당자에게 지급 후 증빙 자료로 정산하는 방식 채택",
      },
      {
        agenda: "무료 체험단·서포터즈 예산안: 대행사(비빔) vs 직접 운영 비교",
        decision: "대행사는 50건 진행 시 300만원대로 부담이 커, 직접 운영(서포터즈) 방식과 계속 비교 검토하기로 함 (결론 보류)",
      },
      {
        agenda: "닥터스웰과의 마케팅 전략 피드백 및 KPI 설정",
        decision: "ROAS 200%를 목표로 데이터 기반 마케팅으로 전환, 매출 전환 가능성 높은 채널에 집중하고 8월 말 메가와리 행사를 중심으로 로드맵 재조정",
      },
      {
        agenda: "큐텐 일본 진출 지원 사업 참여 여부",
        decision: "큐텐 일본 진출 지원 사업(한국콘텐츠진흥원) 신청 확정",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/1FJMP7OLL8_0XfWf8JR2YVYu3px_AMtvp-t1UJ3X9q3U/edit",
  },
  {
    driveFileId: "1QA4xOShQwV5dXwU6SYArBrVcYdwyJeJFwT_wSKP-CWA",
    meetingDate: "2026-07-12T20:49:00+09:00",
    title: "2026년 7월 12일의 회의록",
    items: [
      {
        agenda: "부스 상주/로테이션 인력 구성",
        decision: "부스 상주 인원 5명, 1시간 30분 단위 로테이션 근무 도입",
      },
      {
        agenda: "굿즈(키링·스티커) 및 X배너 제작",
        decision: "키링 15개(5cm 크기)·스티커 및 X배너(3만원) 즉시 발주",
      },
      {
        agenda: "부스 디스플레이(아이패드, 이벤트존, 상담 테이블) 구성",
        decision: "아이패드는 부스 2층 진열대에 배치, JM/페토 구역을 명확히 분리",
      },
      {
        agenda: "마케팅 조직을 브랜딩/서포터즈/큐텐운영으로 세분화",
        decision: "시장조사·브랜딩 / 무료체험단·서포터즈 / 큐텐운영 3개 팀으로 분담",
      },
      {
        agenda: "전체회의 시간 변경 및 부서 자율성 강화",
        decision: "전체 회의를 21시에서 19시로 변경, 부서별 자율 의사결정권 부여",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/1QA4xOShQwV5dXwU6SYArBrVcYdwyJeJFwT_wSKP-CWA/edit",
  },
  {
    driveFileId: "1HUZnx0OfqanNaqsus2Eo2swnTJ1_a8vWr6xgShESu2Y",
    meetingDate: "2026-07-10T19:56:00+09:00",
    title: "2026년 7월 10일의 회의록",
    items: [
      {
        agenda: "아메바 체험단 모집 규모·리워드 구조",
        decision: "30명 선발, 50% 할인 바우처 지급 후 포토 리뷰 작성 시 잔여 50%+배송비를 큐포인트로 환급, 7월 22일 발송 목표",
      },
      {
        agenda: "리스팅 대상자 확보 및 담당자 분담",
        decision: "총 80명 리스팅 목표(정지윤·박서윤·서윤 분담), 다음 주 화요일까지 완료",
      },
      {
        agenda: "굿즈(키링/스티커) 사양 조정",
        decision: "키링 사이즈를 2.5cm에서 5cm로 확대, 수량은 15개로 조정해 예산 10만 원 미만 유지",
      },
      {
        agenda: "부서별 고정 담당자 지정을 통한 업무 효율화",
        decision: "큐텐운영/아메바블로그/SNS광고/예산관리 등 분야별 담당자를 지정하고 슬랙 채널도 업무별로 분리",
      },
      {
        agenda: "노트(Note) SEO 등 신규 마케팅 채널 검토",
        decision: "도입 여부는 결론짓지 않고 계속 검토하기로 함",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/1HUZnx0OfqanNaqsus2Eo2swnTJ1_a8vWr6xgShESu2Y/edit",
  },
  {
    driveFileId: "1_Hg31_IWW5n_gJUY7YUJrF1a_Lhr_Vqj5-LKszSiFOc",
    meetingDate: "2026-06-28T20:55:00+09:00",
    title: "2026년 6월 28일의 회의록",
    items: [
      {
        agenda: "배너/팜플렛 디자인 화질 및 구성 점검",
        decision: "미리캔버스 AI 화질 업그레이드로 이미지 보완, 팜플렛은 8페이지로 재구성",
      },
      {
        agenda: "DHL 글로벌 포워딩 계약 및 수출 면장 처리 방식",
        decision: "보안 문제로 각 기업이 유니패스를 통해 직접 수출 면장을 처리하기로 결정",
      },
      {
        agenda: "팀 운영 예산(150만원) 사용처",
        decision: "JM 정산 후 남은 예산은 팀 운영비로 사용해 향후 샘플 비용 등에 충당 (절감분은 반환 검토)",
      },
      {
        agenda: "큐텐 리뷰 가이드라인 및 광고 전략",
        decision: "리뷰 작성 가이드라인을 제작해 차기 모임에서 공유, 검색상단·스마트세일 상시광고 + 메가와리 기간 키워드광고 집중",
      },
      {
        agenda: "팀복 제작, Claude 활용 교육 일정",
        decision: "팀복은 벌당 약 1.8만원으로 소량 제작 문의, Claude 활용 디자인 교육은 7월 11일로 잠정 확정",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/1_Hg31_IWW5n_gJUY7YUJrF1a_Lhr_Vqj5-LKszSiFOc/edit",
  },
  {
    driveFileId: "13HeZs_QwBS9FLEs-AXi3MRBEyJ7CXUbPWnLPO0um9QY",
    meetingDate: "2026-06-26T20:26:00+09:00",
    title: "2026년 6월 26일의 회의록",
    items: [
      {
        agenda: "링크트리 신원인증 및 결제 오류 해결",
        decision: "여권 인증이 필수임을 확인, 인증 절차를 다시 시도하기로 함",
      },
      {
        agenda: "스튜디오 촬영 vs AI 영상 제작 방식 결정",
        decision: "예약했던 스튜디오 촬영을 취소하고 Gemini AI 영상 제작으로 최종 결정 (5~6개 씬으로 분할 제작)",
      },
      {
        agenda: "큐텐 광고 예산 및 스마트세일즈 활용",
        decision: "큐텐 광고는 이벤트 기간에 집중, 일일 3,000엔으로 예산 설정",
      },
      {
        agenda: "리뷰 확보 전략(메타 광고 체험단)",
        decision: "메타 광고를 통한 체험단 모집 + 팀 보유 샘플로 직접 리뷰 작성을 병행",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/13HeZs_QwBS9FLEs-AXi3MRBEyJ7CXUbPWnLPO0um9QY/edit",
  },
  {
    driveFileId: "1tGMS1z45Ww_G0PKqQnd4T_1FneWSyih7FFf_DVCQTvE",
    meetingDate: "2026-05-09T09:05:00+09:00",
    title: "2026년 5월 9일의 회의록",
    items: [
      {
        agenda: "회의록 자동 작성 툴 테스트, Empa/Google Workspace 구독 유지 여부",
        decision: "테스트 성공 여부에 따라 Empa·Google Workspace 구독 지속 여부를 결정하기로 함",
      },
      {
        agenda: "상세페이지 제작 진행 상황 및 방향성",
        decision: "헤드라인 완성 기한을 다음 주 수요일로 설정",
      },
      {
        agenda: "창업동아리 사무실(7층) 활용 방안",
        decision: "업체 미팅 진행 및 물류 포장 작업 장소로 7층 사무실을 활용하기로 결정",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/1tGMS1z45Ww_G0PKqQnd4T_1FneWSyih7FFf_DVCQTvE/edit",
  },
  {
    driveFileId: "1G6lxXi4mchj5QGDsxN1O9qaJ4ySdnj6-3LPtNpwD9_o",
    meetingDate: "2026-05-03T20:47:00+09:00",
    title: "2026년 5월 3일의 회의록",
    items: [
      {
        agenda: "일본 역직구 보세창고 선입고 물류 전략 검토",
        decision: "저온/정온 보관은 비용이 3.5~4배로 늘어나 비효율적이라 판단, 일반 물류 체인을 사용하기로 결정",
      },
      {
        agenda: "물류사 후보 조사 현황(약 15개사 문의)",
        decision: "보세창고 선입고 + B2C 분할통관 + 일본 현지배송이 가능한 업체 기준으로 계속 재탐색",
      },
      {
        agenda: "큐텐(Qoo10) 신규 브랜드 등록 및 메가와리 참여 조건",
        decision: "메가와리 참가 조건 미충족에 대비해 신규 브랜드 임시 등록을 우선 진행",
      },
      {
        agenda: "상세페이지 제작 툴/협업 방식",
        decision: "Claude로 초안 제작 후 Figma로 편집하는 방식 채택, 5월 5일까지 입점 세팅 완료 목표",
      },
      {
        agenda: "링크드인 바이어 탐색 계획",
        decision: "링크드인 유료 1개월 체험판으로 탐색 진행(기말고사 기간 제외), Apollo.io는 사용하지 않기로 결론",
      },
      {
        agenda: "창업동아리 자동화 툴 예산",
        decision: "자동화 툴(Make) 결제용 공동 카드 등록, 창업동아리 잔액 약 15만원 확인",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/1G6lxXi4mchj5QGDsxN1O9qaJ4ySdnj6-3LPtNpwD9_o/edit",
  },
  {
    driveFileId: "1zndH3j39j3rE3rkHUHR4xf7Ez9V_8fnjNd27h8GJ3bQ",
    meetingDate: "2026-04-30T23:27:00+09:00",
    title: "2026년 4월 30일의 회의록",
    items: [
      {
        agenda: "통관 대기 중 우선순위 과업 선정 (팬드/페토헤드 업체)",
        decision: "랜딩페이지 제작, 링크드인 개설, 바이어 이메일, 보도자료, 유튜브 쇼츠를 우선 착수 과업으로 확정",
      },
      {
        agenda: "부스 비품 재문의 및 유튜브 채널 전략",
        decision: "부스비 결제 후 테이블·조명·의자·MOU 세리모니용 스크린을 추가로 문의하기로 함",
      },
      {
        agenda: "6월 세일 대비 상세페이지 제작 준비",
        decision: "제품정보 수집 → 일본시장/경쟁사 리서치 → 카피라이팅/번역/디자인 순으로 진행",
      },
      {
        agenda: "팀 OKR 설정",
        decision: "목표 1개 + 핵심결과 3개로 구성된 팀 OKR을 설정해 전 팀원과 공유하기로 결정",
      },
    ],
    sourceUrl: "https://docs.google.com/document/d/1zndH3j39j3rE3rkHUHR4xf7Ez9V_8fnjNd27h8GJ3bQ/edit",
  },
];

for (const m of meetings) {
  await prisma.meetingSummary.upsert({
    where: { driveFileId: m.driveFileId },
    create: {
      driveFileId: m.driveFileId,
      meetingDate: new Date(m.meetingDate),
      title: m.title,
      itemsJson: JSON.stringify(m.items),
      sourceUrl: m.sourceUrl,
    },
    update: {
      meetingDate: new Date(m.meetingDate),
      title: m.title,
      itemsJson: JSON.stringify(m.items),
      sourceUrl: m.sourceUrl,
    },
  });
}

console.log(`Seeded ${meetings.length} meeting summaries.`);
const rows = await prisma.meetingSummary.findMany({
  select: { title: true, meetingDate: true },
  orderBy: { meetingDate: "desc" },
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();

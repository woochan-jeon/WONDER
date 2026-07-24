# WONDER

Slack 스타일 UI의 팀 업무관리 워크스페이스. 현재 여섯 개의 채널을 제공합니다.

- **# 할일** — 팀 할일을 만들고, 담당자/마감일을 지정하고, 상태(할 일 / 진행 중 / 완료)를 관리
- **# 캘린더** — 관리자가 연결한 팀 공용 구글 캘린더의 일정을 볼 수 있는 채널
- **# 드라이브** — 연결된 구글 계정의 드라이브를 폴더째로 탐색
- **# 회의록** — 드라이브의 "00. 회의록" 문서를 그대로 임베드해서 보여주는 채널
- **# 회의 아카이브** — Meet Recordings의 Gemini 회의록을 안건·결정사항으로 자동 요약하는 채널
- **# 회계장부** — 프로젝트별 구글 시트 회계장부를 조회하고, 새 수입/지출 항목을 그 시트에 바로 기록

기술 스택: Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma 7 + Postgres (Vercel Postgres/Neon) · Google Calendar/Drive/Sheets API

계정/로그인이 없는 완전 공개 워크스페이스입니다 — 링크만 있으면 누구나 모든 채널에 접속할 수 있습니다.

## 1. 처음 실행하기

Postgres 데이터베이스가 먼저 필요합니다 (배포 시 Vercel Postgres를 쓴다면 8단계 참고, 로컬에서만 테스트한다면 [neon.com](https://neon.com)에서 무료 인스턴스를 만들어 `DATABASE_URL`로 사용해도 됩니다).

```bash
npm install
cp .env.example .env   # DATABASE_URL 등 채우기 (2단계 참고)
npx prisma migrate dev   # 최초 1회: 스키마 적용
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 2. 환경변수 설정

`.env.example`을 복사해 `.env` 파일을 만듭니다.

```bash
cp .env.example .env
```

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | Postgres 연결 문자열. Vercel Postgres(Neon)를 쓰면 Storage 탭에서 자동으로 채워집니다. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | 구글 캘린더 연동용 OAuth 클라이언트 정보. 3단계 참고. |
| `ANTHROPIC_API_KEY` | (선택) # 회의 아카이브 채널의 자동 요약에 사용. 미설정 시 새 회의록이 자동으로 추가되지 않을 뿐, 나머지 기능은 그대로 동작합니다. [console.anthropic.com](https://console.anthropic.com/settings/keys)에서 발급. |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_REDIRECT_URI` | (선택) # 할일 채널에서 슬랙으로 할일을 전송하는 기능용 OAuth 클라이언트 정보. 5단계 참고. 미설정 시 "슬랙 연결" 버튼이 그냥 보이지 않을 뿐, 나머지 기능은 그대로 동작합니다. |

## 3. Google Calendar 연동 설정 (한 번만 하면 됨)

팀 캘린더 채널은 누군가 한 번 자신의 구글 캘린더를 연결하면, 그 이후로는 링크에 접속하는 모두가 그 일정을 볼 수 있는 구조입니다. 연동하려면 Google Cloud Console에서 OAuth 클라이언트를 직접 발급받아야 합니다.

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속해 새 프로젝트를 만들거나 기존 프로젝트를 선택합니다.
2. 좌측 메뉴 **APIs & Services → Library**에서 `Google Calendar API`를 검색해 **Enable(사용 설정)** 합니다.
3. **APIs & Services → OAuth consent screen**으로 이동해 동의 화면을 설정합니다.
   - User Type은 팀 규모가 작다면 `External` + 테스트 사용자로 등록하거나, Google Workspace 조직이라면 `Internal` 선택.
   - 앱 이름, 지원 이메일 등 필수 항목만 입력하면 됩니다.
   - `External`을 선택했다면 **Test users**에 캘린더를 연결할 관리자의 구글 이메일을 추가해야 로그인 시 차단되지 않습니다.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**를 클릭합니다.
   - Application type: `Web application`
   - Authorized redirect URIs에 다음 주소를 정확히 추가:
     - 로컬 개발: `http://localhost:3000/api/calendar/oauth/callback`
     - 배포 후에는 실제 도메인으로 동일한 경로를 추가로 등록 (예: `https://your-domain.com/api/calendar/oauth/callback`)
5. 생성된 **Client ID**와 **Client Secret**을 `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 붙여넣습니다. `GOOGLE_REDIRECT_URI`는 4번에서 등록한 콜백 주소와 **완전히 동일하게** 맞춰주세요.
6. 서버를 재시작한 뒤, **# 캘린더** 채널 → **구글 캘린더 연결** 버튼을 클릭해 구글 로그인 동의 화면에서 권한을 승인합니다.
7. 이후부터는 링크에 접속하는 누구나 연결된 캘린더의 예정된 일정을 조회할 수 있습니다. 조회만 가능하며(읽기 전용 권한), 이 앱에서 일정을 생성/수정하지는 않습니다.

> 연결을 끊고 싶다면 캘린더 채널 상단의 **연결 해제** 버튼을 사용하세요. 로그인이 없으므로 접속하는 누구나 연결/해제할 수 있습니다.

## 4. 회의 아카이브 자동 요약

**# 회의 아카이브** 채널은 드라이브의 "Meet Recordings" 폴더(WON:DER 팀 드라이브 루트 하위)에서 Gemini가 자동 생성한 회의록 문서(파일명에 "Gemini가 작성한 회의록" 포함)를 감지해, Claude API로 안건·결정사항을 요약해 저장합니다.

- `ANTHROPIC_API_KEY`가 설정되어 있으면, 누군가 **# 회의 아카이브** 채널을 열 때마다 서버가 Meet Recordings 폴더를 확인해 아직 정리되지 않은 새 회의록이 있으면 자동으로 요약해 추가합니다. 이미 정리된 문서는 다시 처리하지 않습니다.
- 별도의 백그라운드 작업이나 크론(cron)은 없습니다 — 채널을 방문하는 것 자체가 동기화 트리거입니다.
- 요약 1건당 Claude API 비용이 소량 발생합니다.
- 요약 로직은 `src/lib/meeting-summarizer.ts`(Claude 호출), `src/lib/meeting-archive-sync.ts`(신규 문서 감지·저장)에 있습니다.

## 5. 회계장부 연동

**# 회계장부** 채널은 새 계정을 만들지 않고, 이미 쓰고 있는 구글 시트 회계장부에 직접 읽고 씁니다 — 캘린더/드라이브와 같은 구글 계정 연결을 재사용합니다.

- 어떤 프로젝트가 어떤 시트에 연결되는지는 `src/lib/google-sheets.ts`의 `LEDGER_PROJECTS` 상수에 시트 ID로 하드코딩되어 있습니다. 프로젝트를 추가/변경하려면 이 상수를 수정하세요. 항목 하나가 시트 여러 개에 동시에 기록되게 설정할 수도 있습니다(예: 같은 장부를 공개용/내부용 두 파일로 나눠 쓰는 경우).
- 대상 시트는 `날짜 | 시간 | 내용 | 이름 | 결제수단 | 수입 | 지출 | 잔액 | 비고 | 영수증` 열 구성과 "회계장부"라는 이름의 탭을 가지고 있어야 합니다. 잔액은 수식이 아니라 이전 잔액에 수입/지출을 더한 값을 앱이 직접 계산해 기록합니다.
- 시트를 읽고 쓰려면 `spreadsheets` 스코프가 필요합니다. 캘린더/드라이브 연동을 이 기능이 추가되기 전에 이미 설정했다면, **# 회계장부** 채널에 "재연결" 버튼이 뜹니다 — 눌러서 시트 접근 동의를 다시 받아주세요. 기존 캘린더/드라이브 연결은 그대로 유지됩니다.

## 6. Slack 연동 설정 (할일 → 슬랙 전송)

**# 할일** 채널에서 할일 내용을 슬랙 채널로 전송하려면, 구글 캘린더와 마찬가지로 누군가 한 번 슬랙 워크스페이스를 연결해야 합니다. 이후로는 링크에 접속하는 모두가 할일마다 슬랙 채널을 선택하고 전송 버튼을 쓸 수 있습니다.

1. [api.slack.com/apps](https://api.slack.com/apps)에서 **Create New App → From scratch**로 새 앱을 만들고, 연결할 워크스페이스를 선택합니다.
2. 좌측 메뉴 **OAuth & Permissions**로 이동합니다.
   - **Redirect URLs**에 다음 주소를 추가:
     - 로컬 개발: `http://localhost:3000/api/slack/oauth/callback`
     - 배포 후에는 실제 도메인으로 동일한 경로를 추가로 등록 (예: `https://your-domain.com/api/slack/oauth/callback`)
   - **Scopes → Bot Token Scopes**에 다음 네 개를 추가: `channels:read`, `groups:read`, `chat:write`, `chat:write.public`
   - 페이지 상단의 **Save URLs**를 눌러 저장합니다.
3. 좌측 메뉴 **Basic Information**으로 이동해 **App Credentials**에서 **Client ID**와 **Client Secret**을 확인합니다.
4. 이 값을 `.env`의 `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`에 붙여넣습니다. `SLACK_REDIRECT_URI`는 2번에서 등록한 콜백 주소와 **완전히 동일하게** 맞춰주세요.
5. 서버를 재시작한 뒤, **# 할일** 채널 상단의 **슬랙 연결** 버튼을 클릭해 슬랙 인증 화면에서 권한을 승인합니다.
6. 이후부터 할일을 만들거나 수정할 때 슬랙 채널을 선택할 수 있고, 각 할일 카드의 **💬 전송** 버튼으로 해당 채널에 할일 내용을 메시지로 보낼 수 있습니다. `chat:write.public` 스코프 덕분에 공개 채널은 봇을 초대하지 않아도 전송되지만, 비공개 채널은 봇을 먼저 초대해야 합니다.

> 연결을 끊고 싶다면 할일 채널 상단의 **슬랙 연결 해제** 버튼을 사용하세요. 로그인이 없으므로 접속하는 누구나 연결/해제할 수 있습니다.

## 7. 할일 담당자

계정이 없기 때문에 할일 담당자는 실제 로그인 계정이 아니라 그냥 이름 문자열입니다. 담당자 선택 UI에는 `src/components/task-board.tsx`의 `TEAM_MEMBERS` 상수에 있는 이름들이 기본으로 뜨고, 그 외 이름은 직접 입력할 수 있습니다. 팀원 명단이 바뀌면 이 상수만 수정하면 됩니다.

## 8. 프로젝트 구조

```
src/
  app/
    (app)/            워크스페이스 (사이드바 레이아웃) — 로그인 없이 바로 접근
      tasks/          # 할일 채널
      calendar/       # 캘린더 채널
      drive/          # 드라이브 채널
      minutes/        # 회의록 채널
      archive/        # 회의 아카이브 채널
      ledger/         # 회계장부 채널
    api/calendar/     구글 OAuth 콜백 라우트
    api/slack/        슬랙 OAuth 콜백 라우트
  components/          Sidebar, 채널 헤더, 할일 보드, 캘린더 아젠다, 회계장부 보드 등 UI
  lib/                 Prisma 클라이언트, 구글 캘린더/드라이브/시트 연동, 슬랙 연동, 회의 요약 로직
prisma/schema.prisma   DB 스키마 (Task, Category, CalendarConnection, SlackConnection, MeetingSummary 등)
```

## 9. 자주 쓰는 명령어

```bash
npm run dev              # 개발 서버 (Turbopack)
npm run build && npm start   # 프로덕션 빌드/실행
npx prisma studio         # DB 내용을 GUI로 확인
npx prisma migrate dev --name <설명>   # 스키마 변경 후 마이그레이션 생성 (로컬)
npx prisma migrate deploy   # 배포된 DB에 마이그레이션 적용 (프로덕션)
```

## 9. Vercel 배포

팀원이 링크 하나로 접속할 수 있게 하려면 Vercel에 배포합니다.

1. GitHub에 이 저장소를 올립니다 (`git init` → `git add` → `git commit` → GitHub에 새 저장소 생성 후 `git push`).
2. [vercel.com](https://vercel.com)에서 새 프로젝트를 만들고 방금 올린 GitHub 저장소를 Import합니다.
3. 프로젝트의 **Storage** 탭에서 **Postgres**(Neon 기반)를 추가합니다 — `DATABASE_URL`이 자동으로 환경변수에 채워집니다.
4. **Settings → Environment Variables**에 나머지 값을 등록합니다: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`(배포 도메인 기준 콜백 주소), `ANTHROPIC_API_KEY`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`(배포 도메인 기준 콜백 주소).
5. Google Cloud Console의 OAuth 클라이언트 **Authorized redirect URIs**와 Slack App의 **Redirect URLs**에도 배포 도메인의 콜백 주소(`https://<도메인>/api/calendar/oauth/callback`, `https://<도메인>/api/slack/oauth/callback`)를 추가합니다.
6. 로컬에서 `npx vercel env pull`로 배포 환경변수를 받아온 뒤 `npx prisma migrate deploy`로 프로덕션 DB에 스키마를 적용합니다.
7. Vercel이 커밋을 푸시할 때마다 자동으로 재배포합니다. 배포된 URL을 팀원에게 공유하면 됩니다.
8. 이미 구글 계정이 연결된 상태에서 회계장부(`spreadsheets` 스코프)가 새로 추가된 경우, **# 회계장부** 채널에서 안내하는 대로 구글 계정을 한 번 재연결해야 시트 접근 권한이 추가됩니다.

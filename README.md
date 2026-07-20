# WONDER

Slack 스타일 UI의 팀 업무관리 워크스페이스. 현재 다섯 개의 채널을 제공합니다.

- **# 할일** — 팀 할일을 만들고, 담당자/마감일을 지정하고, 상태(할 일 / 진행 중 / 완료)를 관리
- **# 캘린더** — 관리자가 연결한 팀 공용 구글 캘린더의 일정을 볼 수 있는 채널
- **# 드라이브** — 연결된 구글 계정의 드라이브를 폴더째로 탐색
- **# 회의록** — 드라이브의 "00. 회의록" 문서를 그대로 임베드해서 보여주는 채널
- **# 회의 아카이브** — Meet Recordings의 Gemini 회의록을 안건·결정사항으로 자동 요약하는 채널

기술 스택: Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma 7 + Postgres (Vercel Postgres/Neon) · 자체 세션 인증(JWT 쿠키) · Google Calendar API

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
| `AUTH_SECRET` | 로그인 세션 쿠키 서명에 쓰는 랜덤 비밀값. 아래 명령으로 생성해 채워주세요. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | 구글 캘린더 연동용 OAuth 클라이언트 정보. 3단계 참고. |
| `ANTHROPIC_API_KEY` | (선택) # 회의 아카이브 채널의 자동 요약에 사용. 미설정 시 새 회의록이 자동으로 추가되지 않을 뿐, 나머지 기능은 그대로 동작합니다. [console.anthropic.com](https://console.anthropic.com/settings/keys)에서 발급. |

`AUTH_SECRET` 생성:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Google Calendar 연동 설정 (관리자 1회만)

팀 캘린더 채널은 **관리자 계정 한 명**이 자신의 구글 캘린더를 연결하면, 팀원 전체가 그 일정을 볼 수 있는 구조입니다. 연동하려면 Google Cloud Console에서 OAuth 클라이언트를 직접 발급받아야 합니다.

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
6. 서버를 재시작한 뒤, 관리자 계정으로 로그인 → **# 캘린더** 채널 → **구글 캘린더 연결** 버튼을 클릭해 구글 로그인 동의 화면에서 권한을 승인합니다.
7. 이후부터는 팀원 누구나 로그인하면 관리자가 연결한 캘린더의 예정된 일정(앞으로 30일)을 조회할 수 있습니다. 조회만 가능하며(읽기 전용 권한), 이 앱에서 일정을 생성/수정하지는 않습니다.

> 연결을 끊고 싶다면 캘린더 채널 상단의 **연결 해제** 버튼을 사용하세요. 관리자만 연결/해제할 수 있습니다.

## 4. 회의 아카이브 자동 요약

**# 회의 아카이브** 채널은 드라이브의 "Meet Recordings" 폴더(WON:DER 팀 드라이브 루트 하위)에서 Gemini가 자동 생성한 회의록 문서(파일명에 "Gemini가 작성한 회의록" 포함)를 감지해, Claude API로 안건·결정사항을 요약해 저장합니다.

- `ANTHROPIC_API_KEY`가 설정되어 있으면, 누군가 **# 회의 아카이브** 채널을 열 때마다 서버가 Meet Recordings 폴더를 확인해 아직 정리되지 않은 새 회의록이 있으면 자동으로 요약해 추가합니다. 이미 정리된 문서는 다시 처리하지 않습니다.
- 별도의 백그라운드 작업이나 크론(cron)은 없습니다 — 채널을 방문하는 것 자체가 동기화 트리거입니다.
- 요약 1건당 Claude API 비용이 소량 발생합니다.
- 요약 로직은 `src/lib/meeting-summarizer.ts`(Claude 호출), `src/lib/meeting-archive-sync.ts`(신규 문서 감지·저장)에 있습니다.

## 5. 회원가입 / 로그인

- `/signup`에서 이름, 이메일, 비밀번호만 입력하면 누구나 가입할 수 있습니다 (초대 코드 없음).
- 가장 먼저 가입한 사람이 자동으로 관리자 권한을 가집니다. 이후 가입자는 일반 팀원(member)입니다.
- 로그인 세션은 30일간 유지되는 httpOnly 쿠키로 관리됩니다.

## 6. 프로젝트 구조

```
src/
  app/
    (auth)/          로그인, 회원가입 페이지 및 서버 액션
    (app)/            로그인 후 워크스페이스 (사이드바 레이아웃)
      tasks/          # 할일 채널
      calendar/       # 캘린더 채널
      drive/          # 드라이브 채널
      minutes/        # 회의록 채널
      archive/        # 회의 아카이브 채널
    api/calendar/     구글 OAuth 콜백 라우트
  components/          Sidebar, 채널 헤더, 할일 보드, 캘린더 아젠다 등 UI
  lib/                 인증, Prisma 클라이언트, 구글 캘린더/드라이브 연동, 회의 요약 로직
prisma/schema.prisma   DB 스키마 (User, Task, CalendarConnection, MeetingSummary 등)
```

## 7. 자주 쓰는 명령어

```bash
npm run dev              # 개발 서버 (Turbopack)
npm run build && npm start   # 프로덕션 빌드/실행
npx prisma studio         # DB 내용을 GUI로 확인
npx prisma migrate dev --name <설명>   # 스키마 변경 후 마이그레이션 생성 (로컬)
npx prisma migrate deploy   # 배포된 DB에 마이그레이션 적용 (프로덕션)
```

## 8. Vercel 배포

팀원이 링크 하나로 접속할 수 있게 하려면 Vercel에 배포합니다.

1. GitHub에 이 저장소를 올립니다 (`git init` → `git add` → `git commit` → GitHub에 새 저장소 생성 후 `git push`).
2. [vercel.com](https://vercel.com)에서 새 프로젝트를 만들고 방금 올린 GitHub 저장소를 Import합니다.
3. 프로젝트의 **Storage** 탭에서 **Postgres**(Neon 기반)를 추가합니다 — `DATABASE_URL`이 자동으로 환경변수에 채워집니다.
4. **Settings → Environment Variables**에 나머지 값을 등록합니다: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`(배포 도메인 기준 콜백 주소), `ANTHROPIC_API_KEY`.
5. Google Cloud Console의 OAuth 클라이언트 **Authorized redirect URIs**에도 배포 도메인의 콜백 주소(`https://<도메인>/api/calendar/oauth/callback`)를 추가합니다.
6. 로컬에서 `npx vercel env pull`로 배포 환경변수를 받아온 뒤 `npx prisma migrate deploy`로 프로덕션 DB에 스키마를 적용합니다.
7. Vercel이 커밋을 푸시할 때마다 자동으로 재배포합니다. 배포된 URL을 팀원에게 공유하면 됩니다.

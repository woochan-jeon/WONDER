"use client";

import { useActionState, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import {
  addLangScoreAction,
  createExhibitionAction,
  createMemberAction,
  deleteExhibitionAction,
  deleteLangScoreAction,
  deleteMemberAction,
  updateExhibitionAction,
  updateMemberFlagsAction,
  type ActionState,
  type MemberFlagsPatch,
} from "@/app/(app)/certification/actions";
import {
  CERT_LABELS,
  CERT_PATH_A_CHOICES,
  CERT_PATH_B_CHOICES,
  EXAMS,
  EXAM_LANGUAGES,
  EXHIBITION_REQUIRED_HOURS,
  GPA_CUMULATIVE_MIN,
  GPA_MAX,
  GPA_SEMESTER_MIN,
  examInputs,
  getExam,
  judgeCerts,
  judgeLangScore,
  judgeTeam,
  langNextGoal,
  levelNeedsScore,
  pickBestScore,
  TEAM_LABELS,
  planGpa,
  type CertField,
  type LangStatus,
  type TeamField,
} from "@/lib/minister-cert";
import { WORKLOG_MEMBER_CANDIDATES } from "@/lib/worklog-roster";

interface LangScoreVM {
  id: string;
  exam: string;
  grade: string | null;
  score: number | null;
}

interface ExhibitionVM {
  id: string;
  name: string;
  location: "DOMESTIC" | "OVERSEAS";
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  hours: number;
}

interface MemberVM extends Record<CertField | TeamField, boolean> {
  id: string;
  name: string;
  gtepCompleted: boolean;
  gpaOk: boolean;
  gpaCheckedAt: string | null; // YYYY-MM-DD
  gpaSemesterOk: boolean;
  gpaSemesterCheckedAt: string | null; // YYYY-MM-DD
  reportSubmitted: boolean;
  langScores: LangScoreVM[];
  exhibitions: ExhibitionVM[];
}

type Status = "pass" | "boundary" | "fail" | "unknown";

interface ConditionInfo {
  id: string;
  label: string;
  status: Status;
  badge: string;
}

const CURRENT_MEMBER_KEY = "wonder:cert:currentMemberId";
const initialState: ActionState = {};

const STATUS_STYLES: Record<Status, { chip: string; text: string }> = {
  pass: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", text: "text-emerald-700" },
  boundary: { chip: "border-amber-200 bg-amber-50 text-amber-700", text: "text-amber-700" },
  fail: { chip: "border-red-200 bg-red-50 text-red-700", text: "text-red-700" },
  unknown: { chip: "border-gray-200 bg-gray-100 text-gray-600", text: "text-gray-600" },
};

const LANG_STATUS: Record<LangStatus, { status: Status; label: string }> = {
  pass: { status: "pass", label: "충족" },
  boundary: { status: "boundary", label: "경계" },
  check: { status: "unknown", label: "확인 필요" },
  fail: { status: "fail", label: "미달" },
};

const INPUT_CLASS =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-[#0066cc]";
const PRIMARY_BUTTON_CLASS =
  "rounded-full bg-[#0066cc] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0071e3] disabled:opacity-60";

export default function CertTracker({ members }: { members: MemberVM[] }) {
  // Client-only component (see cert-tracker-loader.tsx), so `window` is available.
  const [selectedId, setSelectedId] = useState<string | null>(() => window.localStorage.getItem(CURRENT_MEMBER_KEY));
  const current = members.find((m) => m.id === selectedId) ?? members[0] ?? null;

  function select(id: string | null) {
    setSelectedId(id);
    if (id) window.localStorage.setItem(CURRENT_MEMBER_KEY, id);
    else window.localStorage.removeItem(CURRENT_MEMBER_KEY);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <MemberBar members={members} current={current} onSelect={select} />
      {current ? (
        <MemberView key={current.id} member={current} />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          아직 등록된 사람이 없습니다. 위의 <b>사람 관리</b>에서 이름을 추가해 주세요.
        </p>
      )}
    </div>
  );
}

function MemberBar({
  members,
  current,
  onSelect,
}: {
  members: MemberVM[];
  current: MemberVM | null;
  onSelect: (id: string | null) => void;
}) {
  const [managing, setManaging] = useState(members.length === 0);
  const formRef = useRef<HTMLFormElement>(null);
  const [deleting, startDelete] = useTransition();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createMemberAction(prev, formData);
    if (result.createdId) {
      formRef.current?.reset();
      onSelect(result.createdId);
    }
    return result;
  }, initialState);

  const registered = new Set(members.map((m) => m.name));
  const suggestions = WORKLOG_MEMBER_CANDIDATES.filter((n) => !registered.has(n));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="cert-member" className="text-xs text-gray-500">
          사람
        </label>
        <select
          id="cert-member"
          value={current?.id ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          disabled={members.length === 0}
          className={`${INPUT_CLASS} min-w-32 font-medium`}
        >
          {members.length === 0 && <option value="">등록된 사람 없음</option>}
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setManaging((v) => !v)}
          className="text-xs text-gray-500 underline decoration-dotted hover:text-gray-700"
        >
          사람 관리
        </button>
      </div>
      {managing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
          <form ref={formRef} action={formAction} className="flex items-center gap-1">
            <input
              name="name"
              list="cert-member-suggestions"
              placeholder="이름"
              required
              maxLength={30}
              className={`${INPUT_CLASS} w-32 py-1 text-xs`}
            />
            <datalist id="cert-member-suggestions">
              {suggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button type="submit" disabled={pending} className="rounded-full bg-[#0066cc] px-2.5 py-1 text-xs text-white hover:bg-[#0071e3] disabled:opacity-60">
              추가
            </button>
          </form>
          {current && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (!window.confirm(`${current.name}님의 기록을 모두 삭제할까요? 되돌릴 수 없습니다.`)) return;
                startDelete(async () => {
                  await deleteMemberAction(current.id);
                  onSelect(null);
                });
              }}
              className="text-xs text-red-600 hover:underline disabled:opacity-60"
            >
              {current.name} 삭제
            </button>
          )}
          {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MemberView({ member: serverMember }: { member: MemberVM }) {
  const [member, applyPatch] = useOptimistic(serverMember, (m, patch: MemberFlagsPatch) => ({ ...m, ...patch }));
  const [, startTransition] = useTransition();

  function setFlags(patch: MemberFlagsPatch) {
    startTransition(async () => {
      applyPatch(patch);
      await updateMemberFlagsAction(member.id, patch);
    });
  }

  const scored = useMemo(
    () => member.langScores.map((s) => ({ ...s, verdict: judgeLangScore(s) })),
    [member.langScores],
  );
  const best = pickBestScore(scored);
  const certs = judgeCerts(member);
  const team = judgeTeam(member);
  const totalHours = member.exhibitions.reduce((sum, e) => sum + e.hours, 0);
  const gpaMet = member.gpaOk || member.gpaSemesterOk;

  const langStatus: { status: Status; label: string } = best
    ? LANG_STATUS[best.verdict.status]
    : { status: "fail", label: "미충족" };

  // Same order as the 사업단 criteria table: 공통 5 (수료·학점·외국어·보고서·팀 성과) + 선택 (무역자격증).
  const conditions: Record<"gtep" | "gpa" | "lang" | "report" | "team" | "license", ConditionInfo> = {
    gtep: {
      id: "cert-gtep",
      label: "수료",
      status: member.gtepCompleted ? "pass" : "fail",
      badge: member.gtepCompleted ? "수료" : "미수료",
    },
    gpa: { id: "cert-gpa", label: "학점", status: gpaMet ? "pass" : "unknown", badge: gpaMet ? "충족" : "미확인" },
    lang: { id: "cert-lang", label: "외국어", status: langStatus.status, badge: langStatus.label },
    report: {
      id: "cert-report",
      label: "보고서",
      status: member.reportSubmitted ? "pass" : "fail",
      badge: member.reportSubmitted ? "충족" : "미제출",
    },
    team: {
      id: "cert-team",
      label: "팀 성과",
      status: team.met ? "pass" : "fail",
      badge: team.met ? "충족" : "미충족",
    },
    license: {
      id: "cert-license",
      label: "무역자격증",
      status: certs.met ? "pass" : "fail",
      badge: certs.met ? "충족" : "미충족",
    },
  };
  const conditionList = Object.values(conditions);
  // Only a clean pass counts — 경계/미확인/확인 필요 all count as not met.
  const metCount = conditionList.filter((c) => c.status === "pass").length;
  const allMet = metCount === conditionList.length;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-gray-900">
            {member.name} · 장관인증{" "}
            <span className={allMet ? "text-emerald-700" : "text-gray-900"}>
              {metCount} / {conditionList.length}
            </span>{" "}
            충족
          </h2>
          {allMet && (
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              장관인증 요건 충족
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {conditionList.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => document.getElementById(c.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium hover:opacity-80 ${STATUS_STYLES[c.status].chip}`}
            >
              <span aria-hidden>{c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : c.status === "boundary" ? "△" : "?"}</span>
              {c.label}
              <span className="sr-only"> {c.badge}</span>
            </button>
          ))}
        </div>
      </section>

      <ConditionCard index={1} title="GTEP 프로그램 수료" condition={conditions.gtep}>
        <CheckRow checked={member.gtepCompleted} onChange={(v) => setFlags({ gtepCompleted: v })}>
          GTEP 프로그램 수료
        </CheckRow>
        {!member.gtepCompleted && totalHours >= EXHIBITION_REQUIRED_HOURS && (
          <p className="pl-7 text-xs text-emerald-700">
            전시회 {EXHIBITION_REQUIRED_HOURS}시간 요건을 채웠어요. 수료가 확정되면 체크해 주세요.
          </p>
        )}
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500">수료요건 · 개인 전시회 {EXHIBITION_REQUIRED_HOURS}시간</p>
          <ExhibitionSection memberId={member.id} exhibitions={member.exhibitions} totalHours={totalHours} />
        </div>
      </ConditionCard>

      <ConditionCard index={2} title="학업 성적" condition={conditions.gpa}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">아래 중 하나만 충족하면 됩니다 (4.5 만점).</p>
            <CheckRow checked={member.gpaOk} onChange={(v) => setFlags({ gpaOk: v })}>
              전체학기 누적 평점 {GPA_CUMULATIVE_MIN} 이상
            </CheckRow>
            {member.gpaOk && member.gpaCheckedAt && (
              <p className="-mt-1 pl-7 text-xs text-gray-500">{shortDate(member.gpaCheckedAt)} 확인</p>
            )}
            <p className="pl-7 text-xs text-gray-400">또는</p>
            <CheckRow checked={member.gpaSemesterOk} onChange={(v) => setFlags({ gpaSemesterOk: v })}>
              GTEP 활동학기(1학기 또는 2학기) 평점 {GPA_SEMESTER_MIN} 이상
            </CheckRow>
            {member.gpaSemesterOk && member.gpaSemesterCheckedAt && (
              <p className="-mt-1 pl-7 text-xs text-gray-500">{shortDate(member.gpaSemesterCheckedAt)} 확인</p>
            )}
          </div>
          <GpaCalculator key={member.id} />
        </div>
      </ConditionCard>

      <ConditionCard index={3} title="외국어 성적" condition={conditions.lang}>
        <p className="-mt-1 text-xs text-gray-500">TOEIC 850 이상 (상응하는 기타 외국어 점수 인정)</p>
        <LanguageSection memberId={member.id} scored={scored} bestId={best?.id ?? null} />
      </ConditionCard>

      <ConditionCard index={4} title="지역전문가 보고서" condition={conditions.report}>
        <CheckRow checked={member.reportSubmitted} onChange={(v) => setFlags({ reportSubmitted: v })}>
          협력업체 특화지역 시장진출보고서 1건 이상 작성
        </CheckRow>
      </ConditionCard>

      <ConditionCard index={5} title="소속팀 성과 (택1)" condition={conditions.team}>
        <TeamSection member={member} team={team} onToggle={(field, v) => setFlags({ [field]: v })} />
      </ConditionCard>

      <ConditionCard index={6} title="무역자격증 (택1)" condition={conditions.license}>
        <CertificateSection member={member} certs={certs} onToggle={(field, v) => setFlags({ [field]: v })} />
      </ConditionCard>
    </div>
  );
}

function ConditionCard({
  index,
  title,
  condition: { id, status, badge },
  children,
}: {
  index: number;
  title: string;
  condition: ConditionInfo;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          {index}. {title}
        </h3>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status].chip}`}>{badge}</span>
      </div>
      {children}
    </section>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#0066cc]"
      />
      <span>{children}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// 1. 학점 계산기 — inputs live only in component state and are never sent to
// the server, keeping the "GPA numbers are never stored" rule.

function GpaCalculator() {
  const [gpa, setGpa] = useState("");
  const [creditsDone, setCreditsDone] = useState("");
  const [creditsAhead, setCreditsAhead] = useState("");
  const filled = gpa !== "" && creditsDone !== "";
  const plan = filled ? planGpa(Number(gpa), Number(creditsDone), creditsAhead === "" ? NaN : Number(creditsAhead)) : null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-700">학점 계산기</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          현재 누적 평점
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={GPA_MAX}
            step={0.01}
            value={gpa}
            onChange={(e) => setGpa(e.target.value)}
            placeholder="3.55"
            className={`${INPUT_CLASS} w-full`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          이수한 학점
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={creditsDone}
            onChange={(e) => setCreditsDone(e.target.value)}
            placeholder="90"
            className={`${INPUT_CLASS} w-full`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          앞으로 이수할 학점
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={creditsAhead}
            onChange={(e) => setCreditsAhead(e.target.value)}
            placeholder="18"
            className={`${INPUT_CLASS} w-full`}
          />
        </label>
      </div>
      <div className="text-sm">
        {!plan ? (
          <p className="text-xs text-gray-500">
            현재 누적 평점과 학점을 입력하면, 누적 {GPA_CUMULATIVE_MIN}을 넘기려면 앞으로 평균 몇 점이 필요한지
            알려드려요.
          </p>
        ) : plan.kind === "invalid" ? (
          <p className="text-xs text-red-600">{plan.message}</p>
        ) : plan.kind === "met" ? (
          <p className="text-emerald-700">
            누적 평점 {plan.current.toFixed(2)}로 이미 누적 기준({GPA_CUMULATIVE_MIN})을 충족합니다.
          </p>
        ) : plan.kind === "reachable" ? (
          <>
            <p className="text-gray-900">
              앞으로 {creditsAhead}학점을 평균 <b className="text-[#0066cc]">{plan.needed.toFixed(2)}</b> 이상 받으면 누적{" "}
              {GPA_CUMULATIVE_MIN} 달성
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {plan.easierThanSemester
                ? `활동학기 기준(${GPA_SEMESTER_MIN})보다 낮아서 누적 기준이 더 쉬워요.`
                : `누적 기준이 더 어려워요. GTEP 활동학기에 ${GPA_SEMESTER_MIN} 이상을 받으면 활동학기 기준으로 충족됩니다.`}
            </p>
          </>
        ) : (
          <>
            <p className="text-amber-700">
              앞으로 {creditsAhead}학점을 모두 {GPA_MAX}로 받아도 누적 {plan.best.toFixed(2)}까지라 누적 기준은 어려워요.
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              GTEP 활동학기에 {GPA_SEMESTER_MIN} 이상을 받으면 활동학기 기준으로 충족됩니다.
            </p>
          </>
        )}
      </div>
      <p className="text-[11px] text-gray-400">입력한 값은 저장되지 않고 이 화면에서만 계산됩니다.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. 어학

type ScoredVM = LangScoreVM & { verdict: ReturnType<typeof judgeLangScore> };

function LanguageSection({ memberId, scored, bestId }: { memberId: string; scored: ScoredVM[]; bestId: string | null }) {
  const [deleting, startDelete] = useTransition();
  const best = scored.find((s) => s.id === bestId) ?? null;
  const goal = best ? langNextGoal(best, best.verdict) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
        {!best ? (
          <span className="text-gray-500">등록한 성적이 없습니다. 아래에서 성적을 추가해 주세요.</span>
        ) : best.verdict.status === "pass" ? (
          <span className="text-gray-900">
            최종 판정: {best.verdict.examName} {best.verdict.resultLabel} → TOEIC {best.verdict.convertedLabel}{" "}
            <span className="font-semibold text-emerald-700">✓</span>
          </span>
        ) : (
          <span className={STATUS_STYLES[LANG_STATUS[best.verdict.status].status].text}>{goal}</span>
        )}
      </div>

      {scored.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-500">등록한 성적</p>
          <ul className="flex flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
            {scored.map((s) => {
              const st = LANG_STATUS[s.verdict.status];
              return (
                <li
                  key={s.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm ${s.id === bestId ? "bg-[#0066cc]/5" : ""}`}
                >
                  <span className="min-w-28 font-medium text-gray-900">
                    {s.verdict.examName}
                    {s.id === bestId && scored.length > 1 && (
                      <span className="ml-1.5 rounded bg-[#0066cc]/10 px-1 py-0.5 text-[10px] text-[#0066cc]">판정 기준</span>
                    )}
                  </span>
                  <span className="text-gray-700">{s.verdict.resultLabel}</span>
                  <span className="text-gray-500">→ {s.verdict.convertedLabel}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[st.status].chip}`}>{st.label}</span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => startDelete(() => deleteLangScoreAction(s.id))}
                    className="ml-auto text-xs text-gray-400 hover:text-red-600 disabled:opacity-60"
                  >
                    삭제
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <AddLangScoreForm memberId={memberId} />
    </div>
  );
}

function AddLangScoreForm({ memberId }: { memberId: string }) {
  const [language, setLanguage] = useState(EXAM_LANGUAGES[0]);
  const examsForLanguage = EXAMS.filter((e) => e.language === language);
  const [examId, setExamId] = useState(examsForLanguage[0].id);
  const exam = getExam(examId) ?? examsForLanguage[0];
  const inputs = examInputs(exam);
  const [grade, setGrade] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await addLangScoreAction(prev, formData);
    if (!result.error) {
      formRef.current?.reset();
      setGrade("");
    }
    return result;
  }, initialState);

  const showScore = inputs.score && (exam.kind !== "levelScore" || levelNeedsScore(exam, grade || null));

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-500">+ 성적 추가</p>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="exam" value={exam.id} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="언어"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setExamId(EXAMS.find((x) => x.language === e.target.value)!.id);
            setGrade("");
          }}
          className={INPUT_CLASS}
        >
          {EXAM_LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select
          aria-label="시험"
          value={exam.id}
          onChange={(e) => {
            setExamId(e.target.value);
            setGrade("");
          }}
          className={INPUT_CLASS}
        >
          {examsForLanguage.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        {inputs.grade && (
          <select
            aria-label={exam.kind === "levelScore" ? "급수" : "등급"}
            name="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            required
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              {exam.kind === "levelScore" ? "급수" : "등급"}
            </option>
            {inputs.grade.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {showScore && inputs.score && (
          <input
            key={exam.id}
            name="score"
            type="number"
            inputMode="numeric"
            required
            min={inputs.score.min}
            max={inputs.score.max}
            placeholder={`점수 (${inputs.score.min}~${inputs.score.max})`}
            className={`${INPUT_CLASS} w-40`}
          />
        )}
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON_CLASS}>
          {pending ? "추가 중..." : "추가"}
        </button>
      </div>
      {exam.kind === "pending" && (
        <p className="text-xs text-gray-500">新BCT는 원본 환산표가 불명확해 &lsquo;확인 필요&rsquo;로 표시됩니다.</p>
      )}
      {exam.id === "ielts" && <p className="text-xs text-gray-500">0.5 단위 점수는 내림해서 환산합니다 (예: 6.5 → Band 6).</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// 4. 자격증

function CertificateSection({
  member,
  certs,
  onToggle,
}: {
  member: MemberVM;
  certs: ReturnType<typeof judgeCerts>;
  onToggle: (field: CertField, value: boolean) => void;
}) {
  // Emphasize a met path in green; otherwise the path closer to done (by ratio) in blue.
  const ratioA = certs.pathA / 1;
  const ratioB = certs.pathB / 2;
  const emphasis = (met: boolean, mine: number, other: number) =>
    met
      ? "border-emerald-300 bg-emerald-50/60"
      : !certs.met && mine > other
        ? "border-[#0066cc]/40 bg-[#0066cc]/5"
        : "border-gray-200";

  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-start">
      <div className={`flex flex-1 flex-col gap-2 rounded-md border p-3 ${emphasis(certs.aMet, ratioA, ratioB)}`}>
        <p className="text-xs font-semibold text-gray-500">무역자격증 ① · 택1</p>
        {CERT_PATH_A_CHOICES.map((f) => (
          <CheckRow key={f} checked={member[f]} onChange={(v) => onToggle(f, v)}>
            {CERT_LABELS[f]}
          </CheckRow>
        ))}
        <p className={`text-xs ${certs.aMet ? "font-medium text-emerald-700" : "text-gray-500"}`}>{certs.pathA} / 1</p>
      </div>
      <span className="self-center text-xs text-gray-400">또는</span>
      <div className={`flex flex-1 flex-col gap-2 rounded-md border p-3 ${emphasis(certs.bMet, ratioB, ratioA)}`}>
        <p className="text-xs font-semibold text-gray-500">무역자격증 ②</p>
        <CheckRow checked={member.certTradeEnglish1} onChange={(v) => onToggle("certTradeEnglish1", v)}>
          {CERT_LABELS.certTradeEnglish1}
        </CheckRow>
        <p className="text-xs text-gray-500">+ 기타 자격증 택1:</p>
        {CERT_PATH_B_CHOICES.map((f) => (
          <CheckRow key={f} checked={member[f]} onChange={(v) => onToggle(f, v)}>
            {CERT_LABELS[f]}
          </CheckRow>
        ))}
        <p className={`text-xs ${certs.bMet ? "font-medium text-emerald-700" : "text-gray-500"}`}>
          {certs.pathB} / 2{certs.pathBRemaining && ` · ${certs.pathBRemaining}`}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 소속팀 성과 — two tracks, each needing both of its items; either track is enough.

function TeamSection({
  member,
  team,
  onToggle,
}: {
  member: MemberVM;
  team: ReturnType<typeof judgeTeam>;
  onToggle: (field: TeamField, value: boolean) => void;
}) {
  const [first, second] = team.tracks;
  const emphasis = (track: (typeof team.tracks)[number], other: (typeof team.tracks)[number]) =>
    track.met
      ? "border-emerald-300 bg-emerald-50/60"
      : !team.met && track.done > other.done
        ? "border-[#0066cc]/40 bg-[#0066cc]/5"
        : "border-gray-200";

  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-start">
      {[first, second].map((track, i) => (
        <div key={track.title} className="contents">
          {i === 1 && <span className="self-center text-xs text-gray-400">또는</span>}
          <div className={`flex flex-1 flex-col gap-2 rounded-md border p-3 ${emphasis(track, i === 0 ? second : first)}`}>
            <p className="text-xs font-semibold text-gray-500">{track.title}</p>
            {track.fields.map((f) => (
              <CheckRow key={f} checked={member[f]} onChange={(v) => onToggle(f, v)}>
                {TEAM_LABELS[f]}
              </CheckRow>
            ))}
            <p className={`text-xs ${track.met ? "font-medium text-emerald-700" : "text-gray-500"}`}>
              {track.done} / {track.fields.length}
              {!track.met && track.done > 0 && ` · ${TEAM_LABELS[track.fields.find((f) => !member[f])!]}만 남음`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GTEP 수료요건 · 개인 전시회

function ExhibitionSection({
  memberId,
  exhibitions,
  totalHours,
}: {
  memberId: string;
  exhibitions: ExhibitionVM[];
  totalHours: number;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const editing = exhibitions.find((e) => e.id === editingId) ?? null;

  const domestic = exhibitions.filter((e) => e.location === "DOMESTIC").reduce((s, e) => s + e.hours, 0);
  const overseas = totalHours - domestic;
  const percent = Math.min(100, (totalHours / EXHIBITION_REQUIRED_HOURS) * 100);
  const met = totalHours >= EXHIBITION_REQUIRED_HOURS;
  const remaining = Math.max(0, EXHIBITION_REQUIRED_HOURS - totalHours);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-gray-500">근무 인정시간</span>
          <span className="font-semibold text-gray-900">
            {fmtHours(totalHours)} / {EXHIBITION_REQUIRED_HOURS}시간
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={EXHIBITION_REQUIRED_HOURS}
          aria-valuenow={totalHours}
        >
          <div className={`h-full rounded-full ${met ? "bg-emerald-500" : "bg-[#0066cc]"}`} style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-gray-500">
          국내 {fmtHours(domestic)}h · 해외 {fmtHours(overseas)}h ·{" "}
          {met ? <span className="font-medium text-emerald-700">충족</span> : `${fmtHours(remaining)}시간 남음`}
        </p>
      </div>

      {exhibitions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-500">참여 기록</p>
          <ul className="flex flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
            {exhibitions.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 basis-40 truncate font-medium text-gray-900" title={e.name}>
                  {e.name}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${e.location === "DOMESTIC" ? "bg-gray-100 text-gray-600" : "bg-violet-50 text-violet-700"}`}
                >
                  {e.location === "DOMESTIC" ? "국내" : "해외"}
                </span>
                <span className="text-gray-600" title={`${e.startDate} ~ ${e.endDate}`}>
                  {e.startDate === e.endDate ? shortDate(e.startDate) : `${shortDate(e.startDate)}~${shortDate(e.endDate)}`}
                </span>
                <span className="text-gray-500">{daysBetween(e.startDate, e.endDate)}일</span>
                <span className="w-12 text-right font-medium text-gray-900">{fmtHours(e.hours)}h</span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditingId(e.id)} className="text-xs text-gray-400 hover:text-[#0066cc]">
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      if (!window.confirm(`"${e.name}" 기록을 삭제할까요?`)) return;
                      startDelete(() => deleteExhibitionAction(e.id));
                    }}
                    className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-60"
                  >
                    삭제
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-gray-100 pt-3">
        <p className="mb-2 text-xs font-medium text-gray-500">+ 기록 추가</p>
        <ExhibitionForm key={memberId} memberId={memberId} />
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div onClick={() => setEditingId(null)} className="absolute inset-0" aria-hidden />
          <div className="relative z-10 flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">전시회 기록 수정</h3>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
              >
                ✕
              </button>
            </div>
            <ExhibitionForm key={editing.id} exhibition={editing} onDone={() => setEditingId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ExhibitionForm({
  memberId,
  exhibition,
  onDone,
}: {
  memberId?: string;
  exhibition?: ExhibitionVM;
  onDone?: () => void;
}) {
  const [startDate, setStartDate] = useState(exhibition?.startDate ?? "");
  const [endDate, setEndDate] = useState(exhibition?.endDate ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = exhibition ? await updateExhibitionAction(prev, formData) : await createExhibitionAction(prev, formData);
    if (!result.error) {
      if (onDone) onDone();
      else {
        formRef.current?.reset();
        setStartDate("");
        setEndDate("");
      }
    }
    return result;
  }, initialState);

  const invalidRange = Boolean(startDate && endDate && endDate < startDate);
  const days = startDate && endDate && !invalidRange ? daysBetween(startDate, endDate) : null;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      {exhibition ? (
        <input type="hidden" name="exhibitionId" value={exhibition.id} />
      ) : (
        <input type="hidden" name="memberId" value={memberId} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={exhibition?.name}
          placeholder="전시회명"
          className={`${INPUT_CLASS} min-w-0 flex-1 basis-48`}
        />
        <select name="location" required defaultValue={exhibition?.location ?? "DOMESTIC"} className={INPUT_CLASS}>
          <option value="DOMESTIC">국내</option>
          <option value="OVERSEAS">해외</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="startDate"
          type="date"
          required
          aria-label="시작일"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            if (!endDate) setEndDate(e.target.value);
          }}
          className={INPUT_CLASS}
        />
        <span className="text-sm text-gray-400">~</span>
        <input
          name="endDate"
          type="date"
          required
          aria-label="종료일"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
          className={INPUT_CLASS}
        />
        <span className="text-xs text-gray-500">일수: {days !== null ? `${days}일` : "-"} (자동)</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          인정시간
          <input
            name="hours"
            type="number"
            required
            min={0}
            step={0.5}
            inputMode="decimal"
            defaultValue={exhibition?.hours}
            className={`${INPUT_CLASS} w-24`}
          />
          h
        </label>
        <button type="submit" disabled={pending || invalidRange} className={`${PRIMARY_BUTTON_CLASS} ml-auto`}>
          {pending ? "저장 중..." : exhibition ? "저장" : "추가"}
        </button>
      </div>
      {invalidRange && <p className="text-sm text-red-600">종료일은 시작일보다 빠를 수 없습니다.</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------

function shortDate(key: string) {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
}

function daysBetween(startKey: string, endKey: string) {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(endKey) - toUtc(startKey)) / 86_400_000) + 1;
}

function fmtHours(h: number) {
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}

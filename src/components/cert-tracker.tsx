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
  CERT_PATH_B_CHOICES,
  EXAMS,
  EXAM_LANGUAGES,
  EXHIBITION_REQUIRED_HOURS,
  examInputs,
  getExam,
  judgeCerts,
  judgeLangScore,
  langNextGoal,
  levelNeedsScore,
  pickBestScore,
  type CertField,
  type LangStatus,
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

interface MemberVM extends Record<CertField, boolean> {
  id: string;
  name: string;
  gpaOk: boolean;
  gpaCheckedAt: string | null; // YYYY-MM-DD
  reportSubmitted: boolean;
  langScores: LangScoreVM[];
  exhibitions: ExhibitionVM[];
}

type Status = "pass" | "boundary" | "fail" | "unknown";

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
  const totalHours = member.exhibitions.reduce((sum, e) => sum + e.hours, 0);

  const langStatus: { status: Status; label: string } = best
    ? LANG_STATUS[best.verdict.status]
    : { status: "fail", label: "미충족" };

  const conditions: { id: string; label: string; status: Status; badge: string }[] = [
    {
      id: "cert-gpa",
      label: "학점",
      status: member.gpaOk ? "pass" : "unknown",
      badge: member.gpaOk ? "충족" : "미확인",
    },
    { id: "cert-lang", label: "어학", status: langStatus.status, badge: langStatus.label },
    {
      id: "cert-report",
      label: "보고서",
      status: member.reportSubmitted ? "pass" : "fail",
      badge: member.reportSubmitted ? "충족" : "미제출",
    },
    { id: "cert-license", label: "자격증", status: certs.met ? "pass" : "fail", badge: certs.met ? "충족" : "미충족" },
    {
      id: "cert-expo",
      label: "전시회",
      status: totalHours >= EXHIBITION_REQUIRED_HOURS ? "pass" : "fail",
      badge: totalHours >= EXHIBITION_REQUIRED_HOURS ? "충족" : "미충족",
    },
  ];
  // Only a clean pass counts — 경계/미확인/확인 필요 all count as not met.
  const metCount = conditions.filter((c) => c.status === "pass").length;
  const allMet = metCount === conditions.length;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-gray-900">
            {member.name} · 장관인증{" "}
            <span className={allMet ? "text-emerald-700" : "text-gray-900"}>
              {metCount} / {conditions.length}
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
          {conditions.map((c) => (
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

      <ConditionCard id="cert-gpa" index={1} title="학점" status={conditions[0].status} badge={conditions[0].badge}>
        <CheckRow checked={member.gpaOk} onChange={(v) => setFlags({ gpaOk: v })}>
          학점 3.7 이상 (4.5 만점) 충족
        </CheckRow>
        {member.gpaOk && member.gpaCheckedAt && (
          <p className="pl-7 text-xs text-gray-500">{shortDate(member.gpaCheckedAt)} 확인</p>
        )}
      </ConditionCard>

      <ConditionCard id="cert-lang" index={2} title="어학" status={langStatus.status} badge={langStatus.label}>
        <LanguageSection memberId={member.id} scored={scored} bestId={best?.id ?? null} />
      </ConditionCard>

      <ConditionCard
        id="cert-report"
        index={3}
        title="지역전문가 보고서"
        status={conditions[2].status}
        badge={conditions[2].badge}
      >
        <CheckRow checked={member.reportSubmitted} onChange={(v) => setFlags({ reportSubmitted: v })}>
          시장진출보고서 제출
        </CheckRow>
      </ConditionCard>

      <ConditionCard id="cert-license" index={4} title="자격증" status={conditions[3].status} badge={conditions[3].badge}>
        <CertificateSection member={member} certs={certs} onToggle={(field, v) => setFlags({ [field]: v })} />
      </ConditionCard>

      <ConditionCard
        id="cert-expo"
        index={5}
        title="개인 전시회 80시간"
        status={conditions[4].status}
        badge={conditions[4].badge}
      >
        <ExhibitionSection memberId={member.id} exhibitions={member.exhibitions} totalHours={totalHours} />
      </ConditionCard>
    </div>
  );
}

function ConditionCard({
  id,
  index,
  title,
  status,
  badge,
  children,
}: {
  id: string;
  index: number;
  title: string;
  status: Status;
  badge: string;
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
        <p className="text-xs font-semibold text-gray-500">경로 A</p>
        <CheckRow checked={member.certGukmusa1} onChange={(v) => onToggle("certGukmusa1", v)}>
          {CERT_LABELS.certGukmusa1}
        </CheckRow>
        <p className={`text-xs ${certs.aMet ? "font-medium text-emerald-700" : "text-gray-500"}`}>{certs.pathA} / 1</p>
      </div>
      <span className="self-center text-xs text-gray-400">또는</span>
      <div className={`flex flex-1 flex-col gap-2 rounded-md border p-3 ${emphasis(certs.bMet, ratioB, ratioA)}`}>
        <p className="text-xs font-semibold text-gray-500">경로 B</p>
        <CheckRow checked={member.certTradeEnglish1} onChange={(v) => onToggle("certTradeEnglish1", v)}>
          {CERT_LABELS.certTradeEnglish1}
        </CheckRow>
        <p className="text-xs text-gray-500">택1:</p>
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
// 5. 개인 전시회

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

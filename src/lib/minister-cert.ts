// Conditions and TOEIC conversion table for the # 장관인증요건 channel.
//
// Source: 한국외대 지역특화청년무역전문가 양성사업단 「공인외국어 시험 성적 비교표」
// (2026-09-20 정리본). Pure data + logic only, so it can run on both the
// server (validating new scores) and the client (rendering verdicts).

/** TOEIC-equivalent score a language result must reach. */
export const TOEIC_THRESHOLD = 850;

/**
 * How to judge a merged table cell that straddles the threshold (e.g. IELTS
 * Band 6 = 830~870). "low" counts it as not met (still shown as 경계);
 * "high" counts it as met. Switch to "high" once the 사업단 confirms it
 * accepts those boundary grades.
 */
export const MERGE_POLICY: "low" | "high" = "low";

export const EXHIBITION_REQUIRED_HOURS = 80;

// ---------------------------------------------------------------------------
// Conversion table

interface Band {
  low: number;
  high: number;
}

interface RangeRow extends Band {
  min: number;
  max: number;
}

interface GradeOption extends Band {
  value: string;
  label: string;
}

interface LevelOption {
  value: string;
  label: string;
  /** Rows by score; a level with no rows maps every score to `flat`. */
  rows?: RangeRow[];
  flat?: Band;
}

type ExamKind =
  | { kind: "direct" }
  | { kind: "range"; min: number; max: number; rows: RangeRow[] }
  | { kind: "grade"; options: GradeOption[] }
  | { kind: "levelScore"; scoreMin: number; scoreMax: number; levels: LevelOption[] }
  | { kind: "pending"; options: GradeOption[] };

export type ExamDef = ExamKind & {
  id: string;
  language: string;
  name: string;
  /** Lowest result that clears the threshold outright (부록 A-1), used for "next goal" hints. */
  target: string;
};

const b = (low: number, high = low): Band => ({ low, high });
const r = (min: number, max: number, low: number, high = low): RangeRow => ({ min, max, low, high });
const g = (value: string, low: number, high = low, label = value): GradeOption => ({ value, label, low, high });

const OPIC_OPTIONS: GradeOption[] = [
  g("AL", 975, 990, "AL 이상"),
  g("IH", 945),
  g("IM3", 870, 905),
  g("IM2", 745, 830),
  g("IM1", 595, 700),
  g("IL", 390, 540),
  g("NH", 310),
];

const CEFR_OPTIONS = (prefix: (level: string) => string): GradeOption[] => [
  g("C2", 945, 990, prefix("C2")),
  g("C1", 945, 990, prefix("C1")),
  g("B2", 830, 905, prefix("B2")),
  g("B1", 745, 785, prefix("B1")),
  g("A2", 595, 700, prefix("A2")),
  g("A1", 310, 540, prefix("A1")),
];

// IELTS bands are entered in 0.5 steps and rounded down for lookup.
const IELTS_BANDS: Record<number, Band> = {
  9: b(990),
  8: b(975),
  7: b(905, 945),
  6: b(830, 870),
  5: b(745, 785),
  4: b(645, 700),
  3: b(595),
  2: b(470, 540),
};
const IELTS_OPTIONS: GradeOption[] = [];
for (let v = 9; v >= 1; v -= 0.5) {
  const band = IELTS_BANDS[Math.floor(v)];
  const value = v.toFixed(1);
  // Band 1 isn't in the table; low/high 0 makes it read as 미달.
  IELTS_OPTIONS.push(g(value, band?.low ?? 0, band?.high ?? 0, value));
}

export const EXAMS: ExamDef[] = [
  { id: "toeic", language: "영어", name: "TOEIC", kind: "direct", target: `${TOEIC_THRESHOLD}점 이상` },
  {
    id: "toefl",
    language: "영어",
    name: "TOEFL iBT",
    kind: "range",
    min: 0,
    max: 120,
    target: "97점 이상",
    rows: [
      r(117, 120, 990),
      r(112, 116, 975),
      r(106, 111, 945),
      r(102, 105, 905),
      r(97, 101, 870),
      r(91, 96, 830),
      r(86, 90, 785),
      r(81, 85, 745),
      r(75, 80, 700),
      r(69, 74, 645),
      r(63, 68, 595),
      r(55, 62, 540),
      r(39, 54, 470),
      r(17, 38, 390),
    ],
  },
  {
    id: "teps",
    language: "영어",
    name: "TEPS",
    kind: "range",
    min: 0,
    max: 600,
    target: "371점 이상",
    rows: [
      r(532, 600, 990),
      r(489, 531, 975),
      r(438, 488, 945),
      r(405, 437, 905),
      r(371, 404, 870),
      r(341, 370, 830),
      r(322, 340, 785),
      r(301, 321, 745),
      r(280, 300, 700),
      r(258, 279, 645),
      r(239, 257, 595),
      // The source prints these two rows as "409~238" (540) and "215~408"
      // (470), which is clearly a typo; the split point between them is
      // unknown, so the gap is merged. Either way it's far below 850.
      r(215, 238, 470, 540),
      r(149, 214, 390),
    ],
  },
  { id: "opic", language: "영어", name: "OPIc", kind: "grade", target: "IM3 이상", options: OPIC_OPTIONS },
  {
    id: "toeic-speaking",
    language: "영어",
    name: "TOEIC Speaking",
    kind: "grade",
    target: "IM3 이상",
    options: OPIC_OPTIONS,
  },
  { id: "ielts", language: "영어", name: "IELTS", kind: "grade", target: "Band 7 이상", options: IELTS_OPTIONS },
  {
    id: "hsk",
    language: "중국어",
    name: "新HSK",
    kind: "levelScore",
    scoreMin: 0,
    scoreMax: 300,
    target: "5급 270점 이상",
    levels: [
      { value: "6", label: "6급", rows: [r(280, 300, 990), r(240, 279, 975), r(180, 239, 945)] },
      { value: "5", label: "5급", rows: [r(270, 300, 870, 905), r(240, 269, 830), r(180, 239, 745, 785)] },
      { value: "4", label: "4급", rows: [r(240, 300, 645, 700), r(0, 239, 470, 595)] },
      { value: "3", label: "3급", rows: [r(240, 300, 390), r(0, 239, 310)] },
    ],
  },
  {
    id: "bct",
    language: "중국어",
    name: "新BCT",
    kind: "pending",
    target: "기준 확인 필요",
    // Source ranges are ambiguous ("300이하" etc.), so these never auto-pass.
    options: [g("300이하", 745, 990), g("240이하", 470, 700), g("120~180", 310, 390)],
  },
  {
    id: "tsc",
    language: "중국어",
    name: "TSC",
    kind: "grade",
    target: "8급 이상",
    options: [
      g("10", 990, 990, "10급"),
      g("9", 945, 975, "9급"),
      g("8", 870, 905, "8급"),
      g("7", 745, 830, "7급"),
      g("6", 645, 700, "6급"),
      g("5", 595, 595, "5급"),
      g("4", 470, 540, "4급"),
      g("3", 390, 390, "3급"),
      g("2", 310, 310, "2급"),
    ],
  },
  { id: "jpt", language: "일본어", name: "JPT", kind: "direct", target: `${TOEIC_THRESHOLD}점 이상` },
  { id: "opic-ja", language: "일본어", name: "OPIc(일본어)", kind: "grade", target: "IM3 이상", options: OPIC_OPTIONS },
  {
    id: "sjpt",
    language: "일본어",
    name: "SJPT",
    kind: "grade",
    target: "Lv8 이상",
    options: [
      g("Lv10", 990),
      g("Lv9", 945, 975),
      g("Lv8", 870, 905),
      g("Lv7", 785, 830),
      g("Lv6", 700, 745),
      g("Lv5", 645),
      g("Lv4", 540, 595),
      g("Lv3", 470),
      g("Lv2", 390),
      g("Lv1", 310),
    ],
  },
  {
    id: "jlpt",
    language: "일본어",
    name: "JLPT",
    kind: "levelScore",
    scoreMin: 0,
    scoreMax: 180,
    target: "N1 120점 이상",
    levels: [
      { value: "N1", label: "N1", rows: [r(150, 180, 990), r(120, 149, 905, 975), r(100, 119, 830, 870)] },
      { value: "N2", label: "N2", flat: b(745, 785) },
      { value: "N3", label: "N3", flat: b(595, 700) },
      { value: "N4", label: "N4", flat: b(540) },
    ],
  },
  {
    id: "torfl",
    language: "러시아어",
    name: "TORFL",
    kind: "grade",
    target: "공인3단계 이상",
    options: [
      g("공인4단계", 990),
      g("공인3단계", 905, 975),
      g("공인2단계", 830, 870),
      g("공인1단계", 745, 785),
      g("기본단계", 645, 700),
      g("기초단계", 540, 595),
    ],
  },
  {
    id: "delf",
    language: "프랑스어",
    name: "DELF/DALF",
    kind: "grade",
    target: "DALF C1 이상",
    // The source lists the bottom row as a second "A2"; assumed to be A1.
    options: CEFR_OPTIONS((level) => (level.startsWith("C") ? `DALF ${level}` : `DELF ${level}`)),
  },
  { id: "goethe", language: "독일어", name: "Goethe-Zertifikat", kind: "grade", target: "C1 이상", options: CEFR_OPTIONS((l) => l) },
  {
    id: "vietnamese",
    language: "베트남어",
    name: "베트남어 능력평가",
    kind: "grade",
    target: "Bậc 5 이상",
    options: [
      g("6", 945, 990, "Bậc 6"),
      g("5", 945, 990, "Bậc 5"),
      g("4", 830, 905, "Bậc 4"),
      g("3", 745, 785, "Bậc 3"),
      g("2", 595, 700, "Bậc 2"),
      g("1", 310, 540, "Bậc 1"),
    ],
  },
  { id: "dele", language: "스페인어", name: "DELE", kind: "grade", target: "C1 이상", options: CEFR_OPTIONS((l) => l) },
];

export const EXAM_LANGUAGES = Array.from(new Set(EXAMS.map((e) => e.language)));

export function getExam(id: string) {
  return EXAMS.find((e) => e.id === id);
}

/** Which inputs the "add score" form needs for an exam. */
export function examInputs(exam: ExamDef) {
  switch (exam.kind) {
    case "direct":
      return { grade: null, score: { min: 10, max: 990 } };
    case "range":
      return { grade: null, score: { min: exam.min, max: exam.max } };
    case "grade":
    case "pending":
      return { grade: exam.options.map((o) => ({ value: o.value, label: o.label })), score: null };
    case "levelScore":
      return {
        grade: exam.levels.map((l) => ({ value: l.value, label: l.label })),
        score: { min: exam.scoreMin, max: exam.scoreMax },
      };
  }
}

/** Whether a levelScore exam's chosen level actually needs the score (JLPT N2~N4 don't). */
export function levelNeedsScore(exam: ExamDef, level: string | null) {
  if (exam.kind !== "levelScore") return false;
  const opt = exam.levels.find((l) => l.value === level);
  return !opt || Boolean(opt.rows);
}

// ---------------------------------------------------------------------------
// Verdicts

export type LangStatus = "pass" | "boundary" | "check" | "fail";

export interface LangScoreInput {
  exam: string;
  grade: string | null;
  score: number | null;
}

export interface LangVerdict {
  status: LangStatus;
  /** TOEIC-equivalent range, null when the result isn't in the table. */
  low: number | null;
  high: number | null;
  examName: string;
  /** How the entered result reads, e.g. "99", "6.5 (→6)", "5급 250점". */
  resultLabel: string;
  /** "870" or "830~870", or "표 범위 밖". */
  convertedLabel: string;
}

function judgeBand(band: Band | null): { status: LangStatus; low: number | null; high: number | null } {
  if (!band || band.high === 0) return { status: "fail", low: null, high: null };
  if (band.low >= TOEIC_THRESHOLD) return { status: "pass", ...band };
  if (band.high >= TOEIC_THRESHOLD) return { status: MERGE_POLICY === "high" ? "pass" : "boundary", ...band };
  return { status: "fail", ...band };
}

function bandLabel(low: number | null, high: number | null) {
  if (low === null || high === null) return "표 범위 밖";
  return low === high ? `${low}` : `${low}~${high}`;
}

/** Validates a result and returns an error message, or null when it's acceptable. */
export function validateLangScore(input: LangScoreInput): string | null {
  const exam = getExam(input.exam);
  if (!exam) return "시험을 선택해 주세요";
  const inputs = examInputs(exam);
  if (inputs.grade && !inputs.grade.some((o) => o.value === input.grade)) return "등급을 선택해 주세요";
  const needsScore = exam.kind === "levelScore" ? levelNeedsScore(exam, input.grade) : Boolean(inputs.score);
  if (needsScore && inputs.score) {
    if (input.score === null || !Number.isInteger(input.score)) return "점수를 입력해 주세요";
    if (input.score < inputs.score.min || input.score > inputs.score.max)
      return `점수는 ${inputs.score.min}~${inputs.score.max} 사이여야 합니다`;
  }
  return null;
}

export function judgeLangScore(input: LangScoreInput): LangVerdict {
  const exam = getExam(input.exam);
  if (!exam) {
    return { status: "fail", low: null, high: null, examName: input.exam, resultLabel: "", convertedLabel: "알 수 없는 시험" };
  }
  const base = { examName: exam.name };

  if (exam.kind === "direct") {
    const score = input.score ?? 0;
    return {
      ...base,
      status: score >= TOEIC_THRESHOLD ? "pass" : "fail",
      low: score,
      high: score,
      resultLabel: `${score}`,
      convertedLabel: `${score}`,
    };
  }

  if (exam.kind === "range") {
    const score = input.score ?? -1;
    const row = exam.rows.find((row) => row.min <= score && score <= row.max) ?? null;
    const j = judgeBand(row);
    return { ...base, ...j, resultLabel: `${score}`, convertedLabel: bandLabel(j.low, j.high) };
  }

  if (exam.kind === "pending") {
    const opt = exam.options.find((o) => o.value === input.grade);
    return {
      ...base,
      status: "check",
      low: opt?.low ?? null,
      high: opt?.high ?? null,
      resultLabel: opt?.label ?? input.grade ?? "",
      convertedLabel: opt ? bandLabel(opt.low, opt.high) : "표 범위 밖",
    };
  }

  if (exam.kind === "grade") {
    const opt = exam.options.find((o) => o.value === input.grade) ?? null;
    const j = judgeBand(opt);
    let resultLabel = opt?.label ?? input.grade ?? "";
    if (exam.id === "ielts" && input.grade) {
      const band = Number(input.grade);
      resultLabel = Number.isInteger(band) ? `Band ${band}` : `Band ${band} (→${Math.floor(band)})`;
    }
    return { ...base, ...j, resultLabel, convertedLabel: bandLabel(j.low, j.high) };
  }

  const level = exam.levels.find((l) => l.value === input.grade) ?? null;
  let band: Band | null = null;
  if (level?.flat) band = level.flat;
  else if (level?.rows && input.score !== null) {
    band = level.rows.find((row) => row.min <= input.score! && input.score! <= row.max) ?? null;
  }
  const j = judgeBand(band);
  const scorePart = level?.rows && input.score !== null ? ` ${input.score}점` : "";
  return { ...base, ...j, resultLabel: `${level?.label ?? input.grade ?? ""}${scorePart}`, convertedLabel: bandLabel(j.low, j.high) };
}

const STATUS_RANK: Record<LangStatus, number> = { pass: 3, boundary: 2, check: 1, fail: 0 };

/** Picks the result the final verdict is based on: best status, then highest TOEIC low. */
export function pickBestScore<T extends { verdict: LangVerdict }>(scores: T[]): T | null {
  let best: T | null = null;
  for (const s of scores) {
    if (
      !best ||
      STATUS_RANK[s.verdict.status] > STATUS_RANK[best.verdict.status] ||
      (STATUS_RANK[s.verdict.status] === STATUS_RANK[best.verdict.status] &&
        (s.verdict.low ?? -1) > (best.verdict.low ?? -1))
    ) {
      best = s;
    }
  }
  return best;
}

/** One-line "what's left" hint for an unmet result. */
export function langNextGoal(input: LangScoreInput, verdict: LangVerdict): string | null {
  const exam = getExam(input.exam);
  if (!exam || verdict.status === "pass") return null;
  const head = `${verdict.examName} ${verdict.resultLabel}`;
  if (exam.kind === "direct") return `${head} · ${TOEIC_THRESHOLD - (input.score ?? 0)}점 부족`;
  if (verdict.status === "check") return `${head} · 환산 기준 확인 필요`;
  if (verdict.status === "boundary") return `${head} · 경계(현재 정책상 미충족) · ${exam.target}이면 확실히 충족`;
  return `${head} → ${verdict.convertedLabel} · ${exam.target}이면 충족`;
}

// ---------------------------------------------------------------------------
// Certificates

export const CERT_FIELDS = [
  "certGukmusa1",
  "certTradeEnglish1",
  "certLogistics",
  "certDistribution1",
  "certDistribution2",
  "certImportManager",
] as const;
export type CertField = (typeof CERT_FIELDS)[number];

export const CERT_LABELS: Record<CertField, string> = {
  certGukmusa1: "국제무역사 1급",
  certTradeEnglish1: "무역영어 1급",
  certLogistics: "물류관리사",
  certDistribution1: "유통관리사 1급",
  certDistribution2: "유통관리사 2급",
  certImportManager: "수입관리사",
};

export const CERT_PATH_B_CHOICES: CertField[] = [
  "certLogistics",
  "certDistribution1",
  "certDistribution2",
  "certImportManager",
];

/** 경로A = 국제무역사 1급; 경로B = 무역영어 1급 + (물류/유통 1·2급/수입 중 1개). */
export function judgeCerts(flags: Record<CertField, boolean>) {
  const pathA = flags.certGukmusa1 ? 1 : 0;
  const hasChoice = CERT_PATH_B_CHOICES.some((f) => flags[f]);
  const pathB = (flags.certTradeEnglish1 ? 1 : 0) + (hasChoice ? 1 : 0);
  const aMet = pathA === 1;
  const bMet = pathB === 2;
  let pathBRemaining: string | null = null;
  if (!bMet) {
    if (!flags.certTradeEnglish1 && !hasChoice) pathBRemaining = "무역영어 1급 + 택1 자격증 1개 필요";
    else if (!flags.certTradeEnglish1) pathBRemaining = "무역영어 1급만 남음";
    else pathBRemaining = "택1 자격증 1개 필요";
  }
  return { met: aMet || bMet, pathA, pathB, aMet, bMet, pathBRemaining };
}

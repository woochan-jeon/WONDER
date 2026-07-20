import "server-only";
import { fetch as undiciFetch } from "undici";

export type SummaryItem = { agenda: string; decision: string | null };

export function isSummarizerConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `당신은 한국의 대학생 창업팀(WON:DER, GTEP 사업단)의 회의 아카이브를 관리하는 어시스턴트입니다.
Gemini가 자동 작성한 한국어 회의록(요약/섹션 제목/다음 단계/상세정보)이 주어지면, 그 회의의 핵심 안건들을 뽑아 각 안건에 대해 실제로 내려진 결정이나 결론을 짝지어 정리하세요.

규칙:
- 안건과 결정 모두 한국어로, 간결하고 전문적인 톤으로 작성 (안건 10~40자, 결정 20~80자 내외)
- 보통 회의당 4~7개 항목
- 세부 논의는 관련된 것끼리 하나의 안건으로 묶고, 지엽적인 내용까지 전부 나열하지 않기
- decision에는 안건을 그대로 반복하지 말고 실제로 무엇이 결정/결론났는지 적기
- 현황 공유만 하고 별도 결정이 나지 않은 안건은 decision을 null로 설정
- 반드시 아래와 같은 JSON 배열만 응답하세요. 마크다운 코드펜스나 설명 문장 없이 순수 JSON만 출력합니다.

예시 형식:
[
  {"agenda": "부스 상주/로테이션 인력 구성", "decision": "부스 상주 인원 5명, 1시간 30분 단위 로테이션 근무 도입"},
  {"agenda": "큐텐 내부 광고 운영 현황 공유", "decision": null}
]`;

/** Trims a Gemini meeting-minutes export down to the structured summary section, dropping the raw transcript. */
export function extractStructuredSection(fullText: string): string {
  const marker = "📖 스크립트";
  const idx = fullText.indexOf(marker);
  return idx === -1 ? fullText : fullText.slice(0, idx);
}

export async function summarizeMeetingMinutes(docText: string): Promise<SummaryItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set. Add it to your .env file.");

  const content = extractStructuredSection(docText).slice(0, 20000);

  const res = await undiciFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Anthropic API returned no text content");

  const jsonText = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed: unknown = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) throw new Error("Anthropic response was not a JSON array");

  return parsed.map((item) => {
    if (typeof item !== "object" || item === null || typeof (item as { agenda?: unknown }).agenda !== "string") {
      throw new Error("Anthropic response item missing 'agenda' string");
    }
    const decision = (item as { decision?: unknown }).decision;
    return {
      agenda: (item as { agenda: string }).agenda,
      decision: typeof decision === "string" ? decision : null,
    };
  });
}

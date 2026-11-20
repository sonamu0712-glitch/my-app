// 판정 합치기 (DESIGN.md 4.1 ④ · PLAN.md 작업 9번)
// 단어 규칙 · AI 판정 · 읽기 실패 결과를 안전 규칙대로 합쳐 최종 판정을 만든다.
// 안전 규칙:
//  - 읽을 수 있는 파일이 하나도 없으면 "읽기 실패" (절대 "없음"이 아님)
//  - 일부 파일을 못 읽었으면 최소 "확인 필요"
//  - AI 오류·시간 초과·글 잘림이면 최소 "확인 필요" (절대 "없음"이 아님)
//  - 단어 규칙이 위원회·규제 단서를 찾았으면 최소 "확인 필요" (규칙의 level)
//  - 규칙과 AI 판정이 다르면 더 높은 쪽을 따른다 (놓치는 것이 오탐보다 나쁘다)
//  - 근거가 하나도 없는 "포함"은 "확인 필요"로 내린다
//  - 근거는 단어 규칙이 찾은 문장이 먼저, AI 근거가 다음이며 합쳐서 3개까지. 부총리 문장은 쓰지 않는다.

import type { Evidence, JudgeResult, Reason, Verdict } from "@/types";
import { MAX_EVIDENCES } from "../../types/index";
import type { AttachmentSummary } from "../hwpx/read-file";
import type { RuleResult } from "./rules";
import type { AiResult } from "./ai";

// 공문 구분값·제목·접수 정보는 호출하는 쪽(API)이 채운다.
export type MergedResult = Omit<JudgeResult, "docId" | "title" | "receivedInfo">;

type 정해진판정 = Exclude<Verdict, "읽기 실패">;
const 서열: 정해진판정[] = ["없음", "확인 필요", "포함"];
const 더높은쪽 = (가: 정해진판정, 나: 정해진판정): 정해진판정 => (서열.indexOf(가) >= 서열.indexOf(나) ? 가 : 나);

export function mergeJudgement(읽기: AttachmentSummary, 규칙: RuleResult | null, ai: AiResult | null): MergedResult {
  // 1) 읽은 파일이 없으면 판정하지 않는다.
  if (읽기.allFailed) {
    const 이유들 = 읽기.failReasons.map((칸) => `${칸.fileName}: ${칸.reason}`);
    return {
      verdict: "읽기 실패",
      reasons: [],
      evidences: [],
      failedFiles: 읽기.failedFiles,
      note: 이유들.length > 0 ? `읽을 수 있는 파일이 없습니다. (${이유들.join(" / ")})` : "첨부파일이 없습니다.",
    };
  }

  const 메모: string[] = [];
  let 판정: 정해진판정 = 규칙?.level ?? "없음";
  const 사유 = new Set<Reason>(규칙?.reasons ?? []);

  // 2) AI 결과 반영
  if (ai?.ok) {
    판정 = 더높은쪽(판정, ai.verdict);
    ai.reasons.forEach((사유값) => 사유.add(사유값));
    if (ai.truncated) {
      판정 = 더높은쪽(판정, "확인 필요");
      메모.push("글이 길어 일부만 AI에 보내 확인 필요 처리");
    }
  } else {
    // AI 오류·시간 초과·키 없음: 규칙 결과와 합쳐 최소 "확인 필요"
    판정 = 더높은쪽(판정, "확인 필요");
    const 이유 = ai && !ai.ok ? ai.error : "미실행";
    메모.push(`AI ${이유 === "시간 초과" ? "응답 시간 초과" : `판정 ${이유}`}로 확인 필요 처리`);
  }

  // 3) 일부 파일을 못 읽었으면 최소 "확인 필요"
  if (읽기.failedFiles.length > 0) {
    판정 = 더높은쪽(판정, "확인 필요");
    메모.push(`일부 파일을 읽지 못해 확인 필요 처리 (${읽기.failedFiles.join(", ")})`);
  }

  // 4) 근거: 규칙 먼저, AI 다음. 같은 문장은 한 번만, 부총리 문장은 제외, 3개까지.
  const 근거: Evidence[] = [];
  const 본것 = new Set<string>();
  const 담기 = (후보: Evidence) => {
    const 열쇠 = `${후보.fileName}|${후보.position}|${후보.sentence}`;
    if (본것.has(열쇠) || 후보.sentence.includes("부총리") || 근거.length >= MAX_EVIDENCES) return;
    본것.add(열쇠);
    근거.push(후보);
  };
  (규칙?.evidences ?? []).forEach(담기);
  // AI 근거는 AI가 "없음"이라 한 경우에는 쓰지 않는다 (엉뚱한 문장이 붙는 것을 막는다)
  if (ai?.ok && ai.verdict !== "없음") ai.evidences.forEach(담기);

  // 5) 판정별 정리
  if (판정 === "없음") {
    사유.clear();
    근거.length = 0;
  } else if (판정 === "포함" && 근거.length === 0) {
    판정 = "확인 필요";
    메모.push("근거 문장을 찾지 못해 확인 필요로 내림");
  }

  return {
    verdict: 판정,
    reasons: [...사유],
    evidences: 근거,
    failedFiles: 읽기.failedFiles,
    note: 메모.length > 0 ? 메모.join(" · ") : undefined,
  };
}

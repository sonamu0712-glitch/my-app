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

// 근거 문장은 이 길이까지만 보여 준다 (긴 문단이 통째로 근거가 되어 화면·발송이 불편해지는 것을 막는다)
const 근거최대글자 = 300;

export function mergeJudgement(
  읽기: AttachmentSummary,
  규칙: RuleResult | null,
  ai: AiResult | null,
  글이너무김 = false
): MergedResult {
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
    let AI판정: 정해진판정 = ai.verdict;
    let AI사유: Reason[] = ai.reasons;
    // 규칙이 "포함"까지 확인하지 못한 경우에만 AI를 안전 규칙으로 누른다 (AI 답이 규칙을 뚫지 못하게)
    if (규칙 && 규칙.level !== "포함") {
      // "부총리"만 있고 국무총리·비서실·조정실이 없으면 포함이 아니다.
      const 부총리만 = 규칙.hints.부총리 && !규칙.hints.총리언급 && !규칙.reasons.includes("국무총리비서실") && !규칙.reasons.includes("국무조정실");
      if (부총리만) {
        AI사유 = AI사유.filter((사유값) => 사유값 !== "국무총리비서실" && 사유값 !== "국무조정실");
        if (AI판정 === "포함") {
          AI판정 = "확인 필요";
          메모.push("부총리만 나오는 공문이라 AI의 포함 판정을 확인 필요로 낮춤");
        }
      }
      // 질서위반행위(과태료)만 있고 규제 단어가 없으면 규제가 아니다.
      if (규칙.hints.질서위반 && !규칙.hints.규제) {
        AI사유 = AI사유.filter((사유값) => 사유값 !== "규제");
        if (AI판정 === "포함" && AI사유.length === 0) {
          AI판정 = "확인 필요";
          메모.push("질서위반행위(과태료)만 있어 AI의 포함 판정을 확인 필요로 낮춤");
        }
      }
    }
    판정 = 더높은쪽(판정, AI판정);
    AI사유.forEach((사유값) => 사유.add(사유값));
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

  // 2-2) 글이 너무 길어 일부만 살폈거나, AI에게 지시하는 듯한 표현이 있으면 최소 "확인 필요"
  if (글이너무김) {
    판정 = 더높은쪽(판정, "확인 필요");
    메모.push("글이 매우 길어 앞부분만 살펴 확인 필요 처리");
  }
  if (규칙?.hints.인젝션) {
    판정 = 더높은쪽(판정, "확인 필요");
    메모.push("본문에 AI에게 지시하는 듯한 표현이 있어 확인 필요 처리");
  }

  // 3) 일부 파일을 못 읽었으면 최소 "확인 필요"
  if (읽기.failedFiles.length > 0) {
    판정 = 더높은쪽(판정, "확인 필요");
    메모.push(`일부 파일을 읽지 못해 확인 필요 처리 (${읽기.failedFiles.join(", ")})`);
  }

  // 4) 근거: 규칙 먼저, AI 다음. 같은 문장은 한 번만, 부총리 문장은 제외, 3개까지.
  const 근거: Evidence[] = [];
  const 본것 = new Set<string>();
  const 담기 = (후보: Evidence): boolean => {
    const 열쇠 = `${후보.fileName}|${후보.position}|${후보.sentence}`;
    // 같은 자리에서 이미 담은 더 긴 문장 안에 들어 있는 글(AI가 문장 일부만 낸 경우)은 중복으로 본다.
    const 줄이기 = (글: string) => 글.replace(/\s+/g, "");
    const 이미포함됨 = 근거.some(
      (칸) => 칸.fileName === 후보.fileName && 칸.position === 후보.position && 줄이기(칸.sentence).includes(줄이기(후보.sentence))
    );
    if (본것.has(열쇠) || 이미포함됨 || 후보.sentence.includes("부총리") || 근거.length >= MAX_EVIDENCES) return false;
    본것.add(열쇠);
    근거.push(
      후보.sentence.length > 근거최대글자 ? { ...후보, sentence: `${후보.sentence.slice(0, 근거최대글자)}…` } : 후보
    );
    return true;
  };
  (규칙?.evidences ?? []).forEach(담기);
  // AI 근거는 AI가 "없음"이라 한 경우에는 쓰지 않는다 (엉뚱한 문장이 붙는 것을 막는다)
  let AI근거수 = 0;
  if (ai?.ok && ai.verdict !== "없음") ai.evidences.forEach((칸) => { 담기(칸); if (!칸.sentence.includes("부총리")) AI근거수 += 1; });

  // 5) 판정별 정리
  if (판정 === "없음") {
    사유.clear();
    근거.length = 0;
  } else if (판정 === "포함" && (근거.length === 0 || ((규칙?.level ?? "없음") !== "포함" && AI근거수 === 0))) {
    // 근거가 없거나, 규칙이 확인하지 못한 "포함"을 AI가 근거 없이 내린 경우는 "포함"으로 두지 않는다.
    판정 = "확인 필요";
    메모.push("뒷받침하는 근거 문장을 찾지 못해 확인 필요로 내림");
  }
  // "확인 필요"인데 근거도 메모도 없으면 화면이 안내할 말이 없으므로 이유를 남긴다.
  if (판정 === "확인 필요" && 근거.length === 0 && 메모.length === 0) {
    메모.push("근거로 보여 줄 문장을 특정하지 못했습니다. 사람이 직접 확인해 주세요");
  }

  return {
    verdict: 판정,
    reasons: [...사유],
    evidences: 근거,
    failedFiles: 읽기.failedFiles,
    note: 메모.length > 0 ? 메모.join(" · ") : undefined,
  };
}

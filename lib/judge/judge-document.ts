// 공문 1건 판정 (DESIGN.md 4.1) — 읽기 → 단어 규칙 → AI → 합치기를 한 번에 처리한다.
// 서버 코드에서만 쓴다. 파일 내용은 로그에 남기지 않는다.

import { readAttachment, summarizeAttachments } from "../hwpx/read-file";
import { judgeByRules } from "./rules";
import { judgeByAi } from "./ai";
import { mergeJudgement, type MergedResult } from "./merge";

export interface 첨부 {
  name: string;
  bytes: Uint8Array;
}

export async function judgeDocument(첨부들: 첨부[]): Promise<MergedResult> {
  // 파일은 서로 독립이므로 함께 읽는다.
  const 결과들 = await Promise.all(첨부들.map((칸) => readAttachment(칸.name, 칸.bytes)));
  const 읽기 = summarizeAttachments(결과들);

  // 읽은 글자가 하나도 없으면 규칙·AI는 돌리지 않는다.
  if (읽기.allFailed) return mergeJudgement(읽기, null, null);

  const 규칙 = judgeByRules(읽기.units);
  const ai = await judgeByAi(읽기.units);
  return mergeJudgement(읽기, 규칙, ai);
}

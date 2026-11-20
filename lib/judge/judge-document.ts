// 공문 1건 판정 (DESIGN.md 4.1) — 읽기 → 단어 규칙 → AI → 합치기를 한 번에 처리한다.
// 서버 코드에서만 쓴다. 파일 내용은 로그에 남기지 않는다.

import { readAttachment, summarizeAttachments } from "../hwpx/read-file";
import { judgeByRules } from "./rules";
import { judgeByAi } from "./ai";
import { mergeJudgement, type MergedResult } from "./merge";

// 한 공문에서 단어 규칙·AI가 살필 글자 수의 상한 (CHECK.md SEC-001)
const 최대살필글자수 = 200_000;

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

  // 글이 너무 길면 앞부분만 살핀다. (같은 단어가 수백만 번 반복된 본문 등으로 서버가 멈추는 것을 막는다)
  // 잘랐다는 사실은 합치기에 알려 최소 "확인 필요"로 둔다.
  let 글자수 = 0;
  let 살필개수 = 0;
  for (const 단위 of 읽기.units) {
    if (글자수 + 단위.text.length > 최대살필글자수 && 살필개수 > 0) break;
    글자수 += Math.min(단위.text.length, 최대살필글자수);
    살필개수 += 1;
  }
  const 너무김 = 살필개수 < 읽기.units.length || 읽기.units.some((단위) => 단위.text.length > 최대살필글자수);
  const 살필글 = 읽기.units
    .slice(0, 살필개수)
    .map((단위) => (단위.text.length > 최대살필글자수 ? { ...단위, text: 단위.text.slice(0, 최대살필글자수) } : 단위));

  const 규칙 = judgeByRules(살필글);
  const ai = await judgeByAi(살필글);
  return mergeJudgement(읽기, 규칙, ai, 너무김);
}

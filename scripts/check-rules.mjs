// 단어 규칙 판정을 가짜 공문 24건에 돌려 정답표와 비교하는 확인 스크립트 (작업 7번)
// 실행: npm run check-rules            → 공문별 결과 한 줄씩
//       npm run check-rules -- 11      → 그 공문의 사유·근거 후보까지 자세히
// 읽기 실패 공문(15~20번)은 판정하지 않는다. 그 규칙은 작업 9번(판정 합치기)에서 적용한다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readAttachment, summarizeAttachments } from "../lib/hwpx/read-file.ts";
import { judgeByRules } from "../lib/judge/rules.ts";

const 기준 = new URL("../samples/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const 정답표 = JSON.parse(readFileSync(join(기준, "정답표.json"), "utf8")).공문;
const 찾는번호 = process.argv[2];

let 맞음 = 0, 틀림 = 0, 건너뜀 = 0;
for (const 정답 of 정답표) {
  if (찾는번호 && !정답.폴더.startsWith(찾는번호)) continue;
  const 결과들 = [];
  for (const 파일 of readdirSync(join(기준, 정답.폴더)).sort()) {
    결과들.push(await readAttachment(파일, readFileSync(join(기준, 정답.폴더, 파일))));
  }
  const 요약 = summarizeAttachments(결과들);
  if (요약.failedFiles.length > 0) {
    건너뜀++;
    console.log(`－ ${정답.폴더}: 읽기 실패가 있어 건너뜀 (작업 9번에서 처리)`);
    continue;
  }
  const 규칙 = judgeByRules(요약.units);
  const 판정 = 규칙.level;
  const 판정맞음 = 정답.허용판정.includes(판정);
  // 정답표의 사유는 모두 단어 규칙이 찾아야 한다.
  const 빠진사유 = 정답.사유.filter((사유) => !규칙.reasons.includes(사유));
  // 정답표에 없는 사유가 나오면 알린다(참고).
  const 더나온 = 규칙.reasons.filter((사유) => !정답.사유.includes(사유));
  const 성공 = 판정맞음 && 빠진사유.length === 0;
  if (성공) 맞음++;
  else 틀림++;
  console.log(
    `${성공 ? "○" : "✕"} ${정답.폴더}: 규칙 ${판정} (정답 ${정답.허용판정.join("/")}) · 사유 [${규칙.reasons.join(", ")}]` +
      (빠진사유.length ? ` · 빠진 사유 [${빠진사유.join(", ")}]` : "") +
      (더나온.length ? ` · 정답표에 없는 사유 [${더나온.join(", ")}]` : "")
  );
  if (찾는번호) for (const 근거 of 규칙.evidences) console.log(`     근거 후보 (${근거.fileName} ${근거.position}) ${근거.sentence}`);
}
console.log(`\n맞음 ${맞음} · 틀림 ${틀림} · 건너뜀 ${건너뜀}`);

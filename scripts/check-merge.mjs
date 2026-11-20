// 공문 1건 판정 전체(읽기 → 규칙 → AI → 합치기)를 가짜 공문 24건에 돌려 정답표와 비교하는 스크립트 (작업 9번)
// 실행: npm run check-merge            → 24건 한 줄씩 (OpenAI 호출 약 18회)
//       npm run check-merge -- 11      → 한 건의 사유·근거·메모까지 자세히
// 가짜 공문 글자가 OpenAI 서비스로 전송된다. 키 값은 출력하지 않는다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { judgeDocument } from "../lib/judge/judge-document.ts";

const 기준 = new URL("../samples/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const 정답표 = JSON.parse(readFileSync(join(기준, "정답표.json"), "utf8")).공문;
const 찾는번호 = process.argv[2];

let 맞음 = 0, 틀림 = 0, 가장느린초 = 0;
for (const 정답 of 정답표) {
  if (찾는번호 && !정답.폴더.startsWith(찾는번호)) continue;
  const 첨부들 = readdirSync(join(기준, 정답.폴더)).sort().map((이름) => ({
    name: 이름, bytes: new Uint8Array(readFileSync(join(기준, 정답.폴더, 이름))),
  }));
  const 시작 = Date.now();
  const 결과 = await judgeDocument(첨부들);
  const 초 = (Date.now() - 시작) / 1000;
  가장느린초 = Math.max(가장느린초, 초);
  const 판정맞음 = 정답.허용판정.includes(결과.verdict);
  const 빠진사유 = 정답.사유.filter((사유) => !결과.reasons.includes(사유));
  // 놓침 방지 점검: 정답이 "없음"이 아닌데 "없음"이 나오면 가장 위험한 오류
  const 성공 = 판정맞음 && 빠진사유.length === 0;
  if (성공) 맞음++;
  else 틀림++;
  console.log(
    `${성공 ? "○" : "✕"} ${정답.폴더}: ${결과.verdict} (정답 ${정답.허용판정.join("/")}) · 사유 [${결과.reasons.join(", ")}] · 근거 ${결과.evidences.length}개 · ${초.toFixed(1)}초` +
      (빠진사유.length ? ` · 빠진 사유 [${빠진사유.join(", ")}]` : "")
  );
  if (찾는번호) {
    for (const 근거 of 결과.evidences) console.log(`     근거 (${근거.fileName} ${근거.position}) ${근거.sentence}`);
    if (결과.failedFiles.length) console.log(`     못 읽은 파일: ${결과.failedFiles.join(", ")}`);
    if (결과.note) console.log(`     메모: ${결과.note}`);
  }
}
console.log(`\n맞음 ${맞음} · 틀림 ${틀림} · 가장 오래 걸린 공문 ${가장느린초.toFixed(1)}초`);

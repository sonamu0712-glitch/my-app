// AI 판정을 가짜 공문 몇 건에 실제로 호출해 보는 확인 스크립트 (작업 8번)
// 실행: npm run check-ai -- 01 09 11      (공문 번호를 적은 것만 호출. 번호가 없으면 대표 5건)
// OpenAI 서비스로 가짜 공문의 본문 글자가 전송된다. 파일 이름은 보내지 않는다. 키 값은 출력하지 않는다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readAttachment, summarizeAttachments } from "../lib/hwpx/read-file.ts";
import { judgeByAi } from "../lib/judge/ai.ts";

const 기준 = new URL("../samples/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const 번호들 = process.argv.length > 2 ? process.argv.slice(2) : ["01", "04", "09", "11", "24"];

for (const 번호 of 번호들) {
  const 폴더 = readdirSync(기준).find((이름) => 이름.startsWith(번호));
  if (!폴더) { console.log(`${번호}: 폴더 없음`); continue; }
  const 결과들 = [];
  for (const 파일 of readdirSync(join(기준, 폴더)).sort()) {
    결과들.push(await readAttachment(파일, readFileSync(join(기준, 폴더, 파일))));
  }
  const { units } = summarizeAttachments(결과들);
  const 시작 = Date.now();
  const 답 = await judgeByAi(units);
  const 초 = ((Date.now() - 시작) / 1000).toFixed(1);
  if (!답.ok) { console.log(`${폴더}: AI 실패 (${답.error}) · ${초}초`); continue; }
  console.log(`${폴더}: ${답.verdict} · 사유 [${답.reasons.join(", ")}] · ${초}초${답.truncated ? " · 글이 잘림" : ""}`);
  for (const 근거 of 답.evidences) console.log(`     근거 (${근거.position}) ${근거.sentence}`);
}

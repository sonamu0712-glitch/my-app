// 가짜 공문(samples/)을 공문 단위로 읽어 "읽기 실패"가 제대로 나뉘는지 보여주는 확인 스크립트 (작업 6번)
// 실행: npm run check-read
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readAttachment, summarizeAttachments } from "../lib/hwpx/read-file.ts";

const 기준 = new URL("../samples/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

for (const 폴더 of readdirSync(기준).sort()) {
  if (!statSync(join(기준, 폴더)).isDirectory()) continue;
  const 결과들 = [];
  for (const 파일 of readdirSync(join(기준, 폴더)).sort()) {
    결과들.push(await readAttachment(파일, readFileSync(join(기준, 폴더, 파일))));
  }
  const 요약 = summarizeAttachments(결과들);
  // 읽기 실패가 하나라도 있는 공문만 자세히, 나머지는 한 줄
  const 상태 = 요약.allFailed ? "읽기 실패(전체)" : 요약.failedFiles.length > 0 ? "일부 읽기 실패" : "정상";
  console.log(`${폴더}: ${상태} · 읽은 문단 ${요약.units.length}개`);
  for (const 실패값 of 요약.failReasons) console.log(`    - ${실패값.fileName}: ${실패값.reason}`);
}

// 가짜 공문(samples/)의 HWPX에서 본문 글자를 뽑아 보여주는 확인용 스크립트 (작업 4번)
// 실행: npm run check-extract            → 모든 공문 요약
//       npm run check-extract -- 12      → 폴더 이름이 12로 시작하는 공문의 글자 전체
// 가짜 공문만 읽는다. (Node가 .ts 파일을 바로 불러오는 기능을 사용)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractHwpx } from "../lib/hwpx/extract.ts";

const 기준 = new URL("../samples/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const 찾는번호 = process.argv[2];

for (const 폴더 of readdirSync(기준).sort()) {
  if (!statSync(join(기준, 폴더)).isDirectory()) continue;
  if (찾는번호 && !폴더.startsWith(찾는번호)) continue;
  for (const 파일 of readdirSync(join(기준, 폴더)).sort()) {
    if (!파일.endsWith(".hwpx")) continue;
    try {
      const 결과 = await extractHwpx(readFileSync(join(기준, 폴더, 파일)), 파일);
      console.log(`[${폴더}/${파일}] 문단 ${결과.units.length}개, 표 ${결과.tableCount}개`);
      if (찾는번호) for (const 단위 of 결과.units) console.log(`   (${단위.position}) ${단위.text}`);
    } catch (오류) {
      console.log(`[${폴더}/${파일}] 읽지 못함: ${오류.message}`);
    }
  }
}

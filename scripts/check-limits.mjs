// 읽기 한도·스캔본 규칙 확인 스크립트 (CHECK.md SEC-002 · Gap 7). 실행: npm run check-limits
import JSZip from "jszip";
import { readAttachment } from "../lib/hwpx/read-file.ts";

let 실패 = 0;
const 확인 = (설명, 조건) => { console.log(`${조건 ? "○" : "✕"} ${설명}`); if (!조건) 실패++; };
const 이름공간 = 'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"';
const 문단 = (안쪽) => `<hp:p id="1"><hp:run>${안쪽}</hp:run></hp:p>`;

async function 만들기(본문들, 압축 = "STORE") {
  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  본문들.forEach((본문, 순서) => zip.file(`Contents/section${순서}.xml`, 본문, { compression: 압축 }));
  return await zip.generateAsync({ type: "uint8array", compression: 압축, compressionOptions: { level: 9 } });
}
const 섹션 = (안쪽) => `<?xml version="1.0"?><hs:sec ${이름공간}>${안쪽}</hs:sec>`;

// 1) 정상 파일은 그대로 읽힌다
let 바이트 = await 만들기([섹션(문단("<hp:t>국무총리비서실에 보고한다.</hp:t>"))], "DEFLATE");
let 결과 = await readAttachment("정상.hwpx", 바이트);
확인("정상 HWPX는 읽힘", 결과.ok === true);

// 2) 압축 폭탄: 작은 파일이 풀면 60MB
const 큰글 = 섹션(문단(`<hp:t>${"가".repeat(60 * 1024 * 1024 / 3)}</hp:t>`));
바이트 = await 만들기([큰글], "DEFLATE");
const 시작 = Date.now();
결과 = await readAttachment("폭탄.hwpx", 바이트);
const 초 = (Date.now() - 시작) / 1000;
확인(`압축 폭탄(${(바이트.length / 1024).toFixed(0)}KB → 약 60MB)은 읽기 실패 (${초.toFixed(1)}초)`, 결과.ok === false && 결과.reason.includes("너무 큰") && 초 < 5);

// 3) 본문 파일이 너무 많으면 읽기 실패
바이트 = await 만들기(Array.from({ length: 60 }, () => 섹션(문단("<hp:t>가</hp:t>"))), "DEFLATE");
결과 = await readAttachment("섹션많음.hwpx", 바이트);
확인("본문 파일 60개는 읽기 실패", 결과.ok === false && 결과.reason.includes("너무 큰"));

// 4) 그림이 있고 글자가 제목 정도뿐인 스캔본은 읽기 실패
바이트 = await 만들기([섹션(문단("<hp:t>공문 제목</hp:t>") + 문단('<hp:pic id="1"/>'))], "DEFLATE");
결과 = await readAttachment("스캔본제목만.hwpx", 바이트);
확인("그림 + 글자 30자 이하 → 읽기 실패", 결과.ok === false && 결과.reason.includes("글자를 찾지 못함"));

// 5) 그림이 있어도 본문 글자가 충분하면 정상
바이트 = await 만들기([섹션(문단("<hp:t>이 문서에는 충분히 긴 본문이 들어 있습니다. 국무조정실에 협조를 요청합니다.</hp:t>") + 문단('<hp:pic id="1"/>'))], "DEFLATE");
결과 = await readAttachment("그림과본문.hwpx", 바이트);
확인("그림 + 충분한 본문 → 정상", 결과.ok === true);

console.log(실패 === 0 ? "\n문제 없음" : `\n실패 ${실패}개`);
process.exit(실패 ? 1 : 0);

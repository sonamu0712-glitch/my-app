// 메일 내용·모의 발송 규칙 확인 스크립트 (작업 14번). 실행: npm run check-send
import { readFileSync } from "node:fs";
import { composeMail } from "../lib/send/compose.ts";
import { mockSend } from "../lib/send/mock-send.ts";

let 실패 = 0;
const 확인 = (설명, 조건) => { console.log(`${조건 ? "○" : "✕"} ${설명}`); if (!조건) 실패++; };

const 담당자들 = JSON.parse(readFileSync(new URL("../data/org-chart.sample.json", import.meta.url), "utf8")).담당자;
const 결과 = mockSend(담당자들);
const 개수 = (상태) => 결과.filter((칸) => 칸.status === 상태).length;
확인(`전체 ${담당자들.length}명 모두 결과가 나옴`, 결과.length === 담당자들.length);
확인(`성공 12 · 실패 2(bounce, 형식 오류) · 주소 없음 1 (실제 성공 ${개수("성공")}, 실패 ${개수("실패")}, 주소 없음 ${개수("주소 없음")})`, 개수("성공") === 12 && 개수("실패") === 2 && 개수("주소 없음") === 1);
확인("bounce 주소는 실패", 결과.find((칸) => 칸.officerId === "o014")?.status === "실패");
확인("주소 없음은 건너뜀", 결과.find((칸) => 칸.officerId === "o013")?.status === "주소 없음");

const 메일 = composeMail({
  title: "시험 공문", receivedInfo: "2026-11-20T00:00:00Z", verdict: "포함", reasons: ["위원회-신설", "규제"], failedFiles: ["붙임2.hwpx"],
  evidences: [1, 2, 3, 4].map((번호) => ({ sentence: `근거 문장 ${번호}`, fileName: "붙임1.hwpx", position: "구역 1 · 문단 1" })),
});
확인("제목에 공문 제목이 들어감", 메일.subject === "[공람] 시험 공문");
확인("본문에 판정·사유·접수 정보가 있음", 메일.body.includes("포함") && 메일.body.includes("위원회(신설), 규제") && 메일.body.includes("접수 정보"));
확인("근거 문장은 3개까지만", 메일.body.includes("근거 문장 3") && !메일.body.includes("근거 문장 4"));
확인("모의 발송 안내가 들어감", 메일.body.includes("모의 발송"));

console.log(실패 === 0 ? "\n문제 없음" : `\n실패 ${실패}개`);
process.exit(실패 ? 1 : 0);

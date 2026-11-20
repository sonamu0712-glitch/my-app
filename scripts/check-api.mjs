// 서버 API 안전 규칙 확인 스크립트 (CHECK.md Gap 8 · "사람 확인 없는 발송 0건")
// 실행: 서버를 켠 뒤(npm run dev) 다른 창에서  npm run check-api
//       다른 주소: BENCH_URL=http://localhost:3124 npm run check-api
// 실제 메일은 나가지 않는 모의 발송만 요청한다. 공문 판정(OpenAI 호출)은 하지 않는다.
const 주소 = process.env.BENCH_URL ?? "http://localhost:3000";
let 실패 = 0;
const 확인 = (설명, 조건) => { console.log(`${조건 ? "○" : "✕"} ${설명}`); if (!조건) 실패++; };

const 기본 = {
  docId: "api-check-1", title: "API 시험", receivedInfo: "2026-11-20", reasons: ["규제"],
  evidences: [{ sentence: "규제 문장", fileName: "a.hwpx", position: "구역 1 · 문단 1" }], failedFiles: [],
};
async function 보내기(값, 경로 = "/api/send") {
  const 응답 = await fetch(`${주소}${경로}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(값) });
  let 본문 = null;
  try { 본문 = await 응답.json(); } catch { /* 본문 없음 */ }
  return { 상태: 응답.status, 본문 };
}

let 결과 = await 보내기({ ...기본, verdict: "포함", confirmed: false });
확인("사람 확인 표시가 false면 거절 (NOT_CONFIRMED)", 결과.상태 === 400 && 결과.본문?.error?.code === "NOT_CONFIRMED");
결과 = await 보내기({ ...기본, verdict: "포함" });
확인("확인 표시가 없으면 거절", 결과.상태 === 400);
결과 = await 보내기({ ...기본, verdict: "없음", confirmed: true });
확인('판정 "없음"은 거절 (NOT_SENDABLE)', 결과.상태 === 400 && 결과.본문?.error?.code === "NOT_SENDABLE");
결과 = await 보내기({ ...기본, verdict: "읽기 실패", confirmed: true });
확인('판정 "읽기 실패"는 거절 (NOT_SENDABLE)', 결과.상태 === 400 && 결과.본문?.error?.code === "NOT_SENDABLE");
결과 = await 보내기({ ...기본, verdict: "확인 필요", confirmed: true });
확인('판정 "확인 필요" + 확인 표시 → 모의 발송 성공 (15명, 성공 12·실패 2·주소 없음 1)',
  결과.상태 === 200 && 결과.본문?.mock === true && 결과.본문.results.length === 15 &&
  결과.본문.results.filter((칸) => 칸.status === "성공").length === 12 &&
  결과.본문.results.filter((칸) => 칸.status === "실패").length === 2 &&
  결과.본문.results.filter((칸) => 칸.status === "주소 없음").length === 1);
결과 = await 보내기({ ...기본, verdict: "포함", confirmed: true, recipientIds: ["o001", "o014"] });
확인("받는 사람을 지정하면 그 사람들에게만 (성공 1·실패 1)", 결과.상태 === 200 && 결과.본문.results.length === 2);
결과 = await 보내기({ ...기본, verdict: "포함", confirmed: true, recipientIds: ["없는사람"] });
확인("조직도에 없는 받는 사람은 거절", 결과.상태 === 400);
결과 = await 보내기({ ...기본, verdict: "포함", confirmed: true, evidences: Array(4).fill(기본.evidences[0]) });
확인("근거 문장 4개는 거절", 결과.상태 === 400);
결과 = await fetch(`${주소}/api/send`, { method: "POST", body: "이건 JSON이 아님" });
확인("JSON이 아닌 요청은 거절", 결과.status === 400);

// 판정 API 입력 검사 (OpenAI를 부르지 않는 경우만)
const 폼 = new FormData();
폼.append("docId", "x");
결과 = await fetch(`${주소}/api/judge`, { method: "POST", body: 폼 });
확인("판정 API: 제목이 없으면 거절", 결과.status === 400);

// 보안 헤더
const 화면 = await fetch(`${주소}/`);
확인("보안 헤더: X-Frame-Options DENY", 화면.headers.get("x-frame-options") === "DENY");
확인("보안 헤더: X-Content-Type-Options nosniff", 화면.headers.get("x-content-type-options") === "nosniff");

console.log(실패 === 0 ? "\n문제 없음" : `\n실패 ${실패}개`);
process.exit(실패 ? 1 : 0);

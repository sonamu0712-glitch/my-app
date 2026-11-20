// 발송 기록·중복 방지 규칙 확인 스크립트 (작업 15번). 실행: npm run check-history
import { addResults, loadRecords, saveRecords, sendState } from "../lib/send/history.ts";

let 실패 = 0;
const 확인 = (설명, 조건) => { console.log(`${조건 ? "○" : "✕"} ${설명}`); if (!조건) 실패++; };

// 가짜 저장소 (브라우저 localStorage 대신)
const 만들기 = () => { const 값 = {}; return { getItem: (키) => 값[키] ?? null, setItem: (키, 글) => { 값[키] = 글; }, 값 }; };

// 1) 처음에는 미발송
let 기록 = [];
확인("처음에는 미발송", sendState(기록, "d1").종류 === "미발송");

// 2) 전체 발송: 성공 2 · 실패 1 · 주소 없음 1 → 일부 실패(실패한 사람 1명)
기록 = addResults(기록, "d1", [
  { officerId: "o1", status: "성공" }, { officerId: "o2", status: "성공" },
  { officerId: "o3", status: "실패" }, { officerId: "o4", status: "주소 없음" },
], "2026-11-20T01:00:00.000Z");
let 상태 = sendState(기록, "d1");
확인("실패가 있으면 '일부 실패'이고 실패한 사람이 나옴", 상태.종류 === "일부 실패" && 상태.실패한사람.length === 1 && 상태.실패한사람[0] === "o3");
확인("다른 공문은 여전히 미발송", sendState(기록, "d2").종류 === "미발송");

// 3) 실패한 주소만 다시 보내 성공 → 발송 완료, 다른 사람 기록은 그대로
기록 = addResults(기록, "d1", [{ officerId: "o3", status: "성공" }], "2026-11-20T02:00:00.000Z");
상태 = sendState(기록, "d1");
확인("재발송 성공 후 '발송 완료' (주소 없음은 완료를 막지 않음)", 상태.종류 === "발송 완료" && 상태.시각 === "2026-11-20T02:00:00.000Z");
확인("기록 수는 늘지 않음 (같은 사람 기록은 교체)", 기록.length === 4);

// 4) 저장·불러오기, 깨진 저장값
const 저장 = 만들기();
확인("저장 성공", saveRecords(기록, 저장) === true);
확인("저장한 그대로 불러옴", loadRecords(저장).length === 4);
저장.setItem("send-records-v1", "{깨진 글");
확인("깨진 저장값은 빈 기록으로 처리", loadRecords(저장).length === 0);
저장.setItem("send-records-v1", JSON.stringify([{ docId: "d1" }, { docId: "d1", officerId: "o1", sentAt: "t", status: "성공" }]));
확인("모양이 틀린 기록은 걸러냄", loadRecords(저장).length === 1);
확인("저장소가 없으면 저장은 실패, 불러오기는 빈 목록", saveRecords([], null) === false && loadRecords(null).length === 0);
확인("저장 기록에 공문 내용·주소 칸이 없음", Object.keys(기록[0]).sort().join(",") === "docId,officerId,sentAt,status");

console.log(실패 === 0 ? "\n문제 없음" : `\n실패 ${실패}개`);
process.exit(실패 ? 1 : 0);

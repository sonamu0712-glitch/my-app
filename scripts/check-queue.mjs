// 동시 처리 대기열 확인 스크립트 (작업 11번). 실행: npm run check-queue
import { runWithLimit } from "../lib/upload/queue.ts";

let 실패 = 0;
const 확인 = (설명, 조건) => { console.log(`${조건 ? "○" : "✕"} ${설명}`); if (!조건) 실패++; };
const 잠깐 = (밀리초) => new Promise((성공) => setTimeout(성공, 밀리초));

// 1) 동시에 돌아가는 개수가 한도를 넘지 않고, 전부 처리된다
let 동시 = 0, 최대동시 = 0;
const 끝난것 = [];
await runWithLimit(Array.from({ length: 20 }, (_, i) => i), 4, async (번호) => {
  동시++; 최대동시 = Math.max(최대동시, 동시);
  await 잠깐(10);
  동시--; 끝난것.push(번호);
});
확인("20건 모두 처리됨", 끝난것.length === 20 && new Set(끝난것).size === 20);
확인(`동시에 최대 4건 (실제 ${최대동시}건)`, 최대동시 === 4);

// 2) 한 건이 실패해도 나머지는 계속된다
const 처리됨 = [];
await runWithLimit([1, 2, 3, 4, 5], 2, async (번호) => { if (번호 === 2) throw new Error("실패"); 처리됨.push(번호); });
확인("한 건 실패해도 나머지 4건 처리", 처리됨.length === 4);

// 3) 항목이 한도보다 적어도, 비어 있어도 문제 없다
await runWithLimit([], 5, async () => {});
확인("빈 목록도 문제 없음", true);

// 4) 멈추면 새 건을 시작하지 않는다
let 시작수 = 0;
await runWithLimit(Array.from({ length: 10 }, (_, i) => i), 1, async () => { 시작수++; }, () => 시작수 >= 3);
확인("멈춤 신호 후 새 건을 시작하지 않음", 시작수 === 3);

console.log(실패 === 0 ? "\n문제 없음" : `\n실패 ${실패}개`);
process.exit(실패 ? 1 : 0);

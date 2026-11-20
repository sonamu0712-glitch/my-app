// 시험·측정 스크립트 (PLAN.md 작업 16번)
//  - 30건: 가짜 공문 30건을 실제 /api/judge로 보내 정답률·누락률·"확인 필요" 비율을 잰다.
//  - 100건: 가짜 공문 100건(건당 첨부 3개)을 브라우저와 같은 방식(5건씩 동시)으로 보내 처리 시간을 잰다.
// 실행: 먼저 서버를 켠다 (실제 속도는 배포용 빌드로 잰다)
//        npm run build ; npx next start -p 3124
//       그다음  npm run bench              → 30건과 100건 모두
//               npm run bench -- 30        → 30건만
//               npm run bench -- 100       → 100건만
//       다른 주소: BENCH_URL=http://localhost:3123 npm run bench
// 주의: 가짜 공문 글자가 OpenAI 서비스로 전송된다(공문 1건당 최대 1회 호출). 키 값은 출력하지 않는다.
import JSZip from "jszip";
import { runWithLimit } from "../lib/upload/queue.ts";
import { 시험공문 } from "./bench-cases.mjs";

const 주소 = process.env.BENCH_URL ?? "http://localhost:3124";
const 동시개수 = 5; // 화면(UploadPanel)과 같은 값
const 선택 = process.argv[2];

// ── HWPX 만들기 (최소 구조) ──
const 이름공간 = 'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"';
const 이스케이프 = (글) => 글.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const 문단 = (안쪽, 번호) => `<hp:p id="${번호}"><hp:run>${안쪽}</hp:run></hp:p>`;
const 글조각 = (글) => `<hp:t>${이스케이프(글)}</hp:t>`;
const 표xml = (칸들) =>
  `<hp:tbl>${칸들.map((행) => `<hp:tr>${행.map((글) => `<hp:tc><hp:subList>${문단(글조각(글), 0)}</hp:subList></hp:tc>`).join("")}</hp:tr>`).join("")}</hp:tbl>`;

async function hwpx만들기(칸) {
  if (칸.깨짐) return new Uint8Array([1, 2, 3, 4, 5]);
  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  let 암호 = false;
  let 본문;
  if (칸.암호) {
    암호 = true;
    본문 = new Uint8Array([200, 17, 3, 99, 250, 1, 77, 5, 190, 42, 8, 133]);
  } else if (칸.그림만) {
    본문 = `<?xml version="1.0" encoding="UTF-8"?><hs:sec ${이름공간}>${문단('<hp:pic id="1"><hp:img binaryItemIDRef="image1"/></hp:pic>', 1)}</hs:sec>`;
  } else {
    const 문단들 = (칸.문단 ?? []).map((글, 순서) => 문단(글조각(글), 순서 + 1));
    if (칸.표) 문단들.push(문단(표xml(칸.표), 문단들.length + 1));
    본문 = `<?xml version="1.0" encoding="UTF-8"?><hs:sec ${이름공간}>${문단들.join("")}</hs:sec>`;
  }
  if (암호) zip.file("META-INF/manifest.xml", "<manifest><encryption-data/></manifest>");
  zip.file("Contents/section0.xml", 본문);
  return await zip.generateAsync({ type: "uint8array" });
}

// 총리실과 무관한 채움 첨부 (공문 1건을 첨부 3개로 맞춘다)
const 채움 = [
  { 문단: ["붙임 서식 안내", "제출 서식은 가상부처 누리집에서 내려받아 사용하시기 바랍니다."] },
  { 문단: ["참고 자료", "지난해 현황은 별도 자료와 같습니다. 문의처는 가상부처 총무과입니다."] },
];

async function 첨부들만들기(공문) {
  const 칸들 = [...공문.첨부];
  for (let i = 0; !공문.채우지않음 && 칸들.length < 3; i++) 칸들.push(채움[i % 채움.length]);
  return await Promise.all(칸들.map(async (칸, 순서) => ({ name: `붙임${순서 + 1}.hwpx`, bytes: await hwpx만들기(칸) })));
}

// ── 서버 호출 (브라우저의 judge-client와 같은 방식) ──
async function 판정요청(docId, title, 첨부들) {
  const 폼 = new FormData();
  폼.append("docId", docId);
  폼.append("title", title);
  for (const 칸 of 첨부들) 폼.append("files", new File([칸.bytes], 칸.name));
  const 시작 = Date.now();
  try {
    const 응답 = await fetch(`${주소}/api/judge`, { method: "POST", body: 폼, signal: AbortSignal.timeout(30_000) });
    const 초 = (Date.now() - 시작) / 1000;
    if (!응답.ok) return { 오류: `HTTP ${응답.status}`, 초 };
    return { 결과: await 응답.json(), 초 };
  } catch (오류) {
    return { 오류: 오류?.name === "TimeoutError" ? "30초 시간 초과" : "연결 실패", 초: (Date.now() - 시작) / 1000 };
  }
}

const 백분위 = (값들, 비율) => [...값들].sort((가, 나) => 가 - 나)[Math.min(값들.length - 1, Math.floor(값들.length * 비율))];
const 줄 = (글) => console.log(글);

// ── 30건: 정확도 ──
async function 정확도시험() {
  줄(`\n===== 30건 정확도 시험 (${시험공문.length}건) =====`);
  const 결과표 = new Array(시험공문.length);
  await runWithLimit(시험공문.map((공문, 순서) => ({ 공문, 순서 })), 동시개수, async ({ 공문, 순서 }) => {
    const 첨부들 = await 첨부들만들기(공문);
    결과표[순서] = await 판정요청(`bench-${순서}`, 공문.이름, 첨부들);
  });

  let 정답 = 0, 누락 = 0, 누락대상 = 0, 위규누락 = 0, 위규대상 = 0, 확인필요 = 0, 오류 = 0, 과잉확인 = 0;
  const 틀린것 = [];
  시험공문.forEach((공문, 순서) => {
    const { 결과, 오류: 오류글, 초 } = 결과표[순서];
    const 판정 = 결과?.verdict ?? `오류(${오류글})`;
    if (!결과) 오류++;
    const 맞음 = 공문.허용.includes(판정);
    if (맞음) 정답++;
    else 틀린것.push(`${공문.이름}: ${판정} (정답 ${공문.허용.join("/")})`);
    if (판정 === "확인 필요") 확인필요++;
    if (판정 === "확인 필요" && 공문.허용.length === 1 && 공문.허용[0] === "없음") 과잉확인++;
    if (공문.놓치면안됨 || 공문.분야 === "읽기 실패") {
      누락대상++;
      if (판정 === "없음") 누락++;
    }
    if (공문.분야 === "위원회" || 공문.분야 === "규제") {
      위규대상++;
      if (판정 === "없음") 위규누락++;
    }
    줄(`${맞음 ? "○" : "✕"} ${공문.이름.padEnd(28)} → ${판정.padEnd(6)} (정답 ${공문.허용.join("/")}) · 사유 [${(결과?.reasons ?? []).join(", ")}] · ${초.toFixed(1)}초${결과?.note ? ` · 메모: ${결과.note}` : ""}`);
  });

  const 비율 = (가, 나) => (나 === 0 ? 0 : (가 / 나) * 100);
  줄("\n── 30건 결과 요약 ──");
  줄(`정답률        ${비율(정답, 시험공문.length).toFixed(1)}%  (${정답}/${시험공문.length})  기준 90% 이상`);
  줄(`누락률        ${비율(누락, 누락대상).toFixed(1)}%  (${누락}/${누락대상})  기준 5% 이하  ← 총리실 내용이 있거나 읽기 실패인데 "없음"이 나온 경우`);
  줄(`위원회·규제 누락 ${비율(위규누락, 위규대상).toFixed(1)}%  (${위규누락}/${위규대상})  기준 0%`);
  줄(`"확인 필요" 비율 ${비율(확인필요, 시험공문.length).toFixed(1)}%  (${확인필요}/${시험공문.length})  기준 30% 이하   · 그중 "없음"이 정답인데 확인 필요로 나온 것 ${과잉확인}건`);
  if (오류 > 0) 줄(`서버 오류·연결 실패 ${오류}건`);
  if (틀린것.length > 0) { 줄("틀린 공문:"); 틀린것.forEach((글) => 줄(`  - ${글}`)); }
}

// ── 100건: 처리 시간 ──
async function 시간시험() {
  줄("\n===== 100건 처리 시간 시험 (건당 첨부 3개, 5건씩 동시) =====");
  const 공문들 = Array.from({ length: 100 }, (_, i) => ({ ...시험공문[i % 시험공문.length], 이름: `${시험공문[i % 시험공문.length].이름}_${i + 1}` }));
  // 파일 만들기 시간은 재지 않는다 (미리 만든다)
  const 준비 = await Promise.all(공문들.map(async (공문) => ({ 공문, 첨부들: await 첨부들만들기(공문) })));
  const 총크기 = 준비.reduce((합, 칸) => 합 + 칸.첨부들.reduce((a, b) => a + b.bytes.length, 0), 0);

  const 시작 = Date.now();
  const 초들 = [];
  const 판정수 = {};
  let 오류 = 0, AI문제 = 0;
  await runWithLimit(준비, 동시개수, async ({ 공문, 첨부들 }) => {
    const { 결과 , 초 } = await 판정요청(`bench100-${공문.이름}`, 공문.이름, 첨부들);
    초들.push(초);
    if (!결과) { 오류++; return; }
    판정수[결과.verdict] = (판정수[결과.verdict] ?? 0) + 1;
    if (결과.note && /AI/.test(결과.note)) AI문제++;
  });
  const 전체초 = (Date.now() - 시작) / 1000;

  줄(`올린 공문 100건 · 첨부 300개 · 합계 ${(총크기 / 1024).toFixed(0)}KB`);
  줄(`앱 처리 전체 시간      ${전체초.toFixed(1)}초 (${(전체초 / 60).toFixed(1)}분)`);
  줄(`공문 1건 처리 시간     평균 ${(초들.reduce((a, b) => a + b, 0) / 초들.length).toFixed(1)}초 · 중앙값 ${백분위(초들, 0.5).toFixed(1)}초 · 95% ${백분위(초들, 0.95).toFixed(1)}초 · 최대 ${Math.max(...초들).toFixed(1)}초   기준 10초 이내`);
  줄(`10초를 넘은 공문       ${초들.filter((초) => 초 > 10).length}건`);
  줄(`판정 분포              ${Object.entries(판정수).map(([키, 값]) => `${키} ${값}`).join(" · ")}`);
  줄(`서버 오류·연결 실패    ${오류}건 · AI 문제로 확인 필요 처리 ${AI문제}건`);
  // 1시간 기준: 앱 시간은 겹쳐 흐르므로(사람은 먼저 끝난 공문부터 확인) 가장 보수적으로 "앱을 다 기다린 뒤 사람이 확인"으로 계산한다.
  const 사람초 = 25 * 100;
  줄(`1시간 기준 점검        앱 ${(전체초 / 60).toFixed(1)}분 + 사람 확인 가정 25초×100건 ${(사람초 / 60).toFixed(1)}분 = ${((전체초 + 사람초) / 60).toFixed(1)}분  (기준 60분 이내)`);
}

if (!선택 || 선택 === "30") await 정확도시험();
if (!선택 || 선택 === "100") await 시간시험();

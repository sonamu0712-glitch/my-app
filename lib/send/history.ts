// 발송 기록과 중복 방지 (PLAN.md 작업 15번 · DESIGN.md 4.3·7.1)
// 기록은 이 브라우저(localStorage)에만 저장한다. 서버는 저장하지 않는다.
// 남기는 것: 공문 구분값 · 받는 사람 id · 시각 · 결과뿐이다. 공문 내용·주소는 저장하지 않는다.
// 한계: 다른 컴퓨터·브라우저에서 보낸 기록은 알 수 없다. (화면에도 안내)
// 저장소를 못 쓰는 환경(비공개 창 등)에서도 오류 없이 "기록 없음"으로 동작한다.

import type { SendRecord, SendStatus } from "@/types";

export const 저장키 = "send-records-v1";
type 저장소 = Pick<Storage, "getItem" | "setItem">;
const 상태들: SendStatus[] = ["성공", "실패", "주소 없음"];

function 브라우저저장소(): 저장소 | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // 접근 자체가 막힌 경우
  }
}

function 올바른기록인가(값: unknown): 값 is SendRecord {
  const 칸 = 값 as Partial<SendRecord> | null;
  return (
    !!칸 &&
    typeof 칸.docId === "string" &&
    typeof 칸.officerId === "string" &&
    typeof 칸.sentAt === "string" &&
    상태들.includes(칸.status as SendStatus)
  );
}

// 저장된 기록을 읽는다. 없거나 깨졌으면 빈 목록.
export function loadRecords(저장 = 브라우저저장소()): SendRecord[] {
  if (!저장) return [];
  try {
    const 글 = 저장.getItem(저장키);
    if (!글) return [];
    const 값 = JSON.parse(글);
    return Array.isArray(값) ? 값.filter(올바른기록인가) : [];
  } catch {
    return [];
  }
}

// 기록을 저장한다. 저장하지 못하면 false (호출한 쪽이 사용자에게 알린다).
export function saveRecords(기록들: SendRecord[], 저장 = 브라우저저장소()): boolean {
  if (!저장) return false;
  try {
    저장.setItem(저장키, JSON.stringify(기록들));
    return true;
  } catch {
    return false;
  }
}

// 이번 발송 결과를 기록에 합친다. 같은 공문·같은 받는 사람의 이전 기록은 새 결과로 바뀐다.
export function addResults(
  기존: SendRecord[],
  docId: string,
  결과들: { officerId: string; status: SendStatus }[],
  보낸시각: string
): SendRecord[] {
  const 새기록 = 결과들.map((칸) => ({ docId, officerId: 칸.officerId, sentAt: 보낸시각, status: 칸.status }));
  const 바뀐사람 = new Set(새기록.map((칸) => 칸.officerId));
  return [...기존.filter((칸) => !(칸.docId === docId && 바뀐사람.has(칸.officerId))), ...새기록];
}

// 한 공문의 발송 상태
export type 발송상태 =
  | { 종류: "미발송" }
  | { 종류: "발송 완료"; 시각: string }
  | { 종류: "일부 실패"; 시각: string; 실패한사람: string[] }; // 실패한 주소만 다시 보낼 수 있다

export function sendState(기록들: SendRecord[], docId: string): 발송상태 {
  const 이공문 = 기록들.filter((칸) => 칸.docId === docId);
  if (이공문.length === 0) return { 종류: "미발송" };
  const 시각 = 이공문.map((칸) => 칸.sentAt).sort().at(-1)!;
  const 실패 = 이공문.filter((칸) => 칸.status === "실패").map((칸) => 칸.officerId);
  return 실패.length > 0 ? { 종류: "일부 실패", 시각, 실패한사람: 실패 } : { 종류: "발송 완료", 시각 };
}

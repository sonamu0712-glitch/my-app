// 모의 발송 (PLAN.md 작업 14번 · DESIGN.md 4.3)
// 실제 메일은 보내지 않는다. 받는 사람마다 결과만 계산한다.
//  - 주소가 없으면 "주소 없음"(건너뜀)
//  - 주소 형식이 올바르지 않거나, 시험용 실패 주소(bounce@example.com)면 "실패"
//  - 그 밖에는 "성공"
// 서버는 결과를 저장하지 않는다. (발송 기록은 브라우저가 저장 — 작업 15번)

import type { Officer, SendStatus } from "@/types";

export interface 발송결과 {
  officerId: string;
  status: SendStatus;
}

const 실패처리주소 = ["bounce@example.com"]; // 시험을 위해 일부러 실패하는 가상 주소
const 주소모양 = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function mockSend(받는사람들: Officer[]): 발송결과[] {
  return 받는사람들.map((담당자) => {
    const 주소 = 담당자.email?.trim();
    if (!주소) return { officerId: 담당자.id, status: "주소 없음" };
    if (!주소모양.test(주소) || 실패처리주소.includes(주소.toLowerCase())) return { officerId: 담당자.id, status: "실패" };
    return { officerId: 담당자.id, status: "성공" };
  });
}

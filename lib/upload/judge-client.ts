// 브라우저에서 공문 1건을 판정 API(/api/judge)로 보내고 결과를 받는다 (PLAN.md 작업 11번)
// 어떤 문제가 생겨도 예외를 던지지 않고 "읽기 실패 + 사유 메모" 결과로 돌려준다. 절대 "없음"으로 처리하지 않는다.
// 공문 내용은 화면·콘솔에 남기지 않는다.

import type { JudgeResult } from "@/types";
import type { UploadDoc } from "./group";

const 기다리는시간_밀리초 = 30_000; // 서버 최대 실행 시간(30초)과 맞춘다

function 실패결과(공문: UploadDoc, 접수: string, 메모: string): JudgeResult {
  return {
    docId: 공문.docId,
    title: 공문.title,
    receivedInfo: 접수,
    verdict: "읽기 실패",
    reasons: [],
    evidences: [],
    failedFiles: 공문.files.map((칸) => 칸.name),
    note: 메모,
  };
}

export async function judgeOne(공문: UploadDoc, 접수: string): Promise<JudgeResult> {
  const 폼 = new FormData();
  폼.append("docId", 공문.docId);
  폼.append("title", 공문.title);
  폼.append("receivedInfo", 접수);
  // 공문 폴더 안쪽 경로를 파일 이름으로 보낸다 (서버가 확장자로 형식을 가린다)
  공문.files.forEach((칸) => 폼.append("files", 칸.file, 칸.name));

  try {
    const 응답 = await fetch("/api/judge", { method: "POST", body: 폼, signal: AbortSignal.timeout(기다리는시간_밀리초) });
    if (!응답.ok) {
      let 이유 = `서버 응답 오류(${응답.status})`;
      try {
        const 본문 = await 응답.json();
        if (본문?.error?.message) 이유 = String(본문.error.message);
      } catch {
        // 본문을 못 읽어도 위 기본 문구를 쓴다
      }
      return 실패결과(공문, 접수, `${이유} — 이 공문은 사람이 직접 확인해 주세요.`);
    }
    return (await 응답.json()) as JudgeResult;
  } catch (오류) {
    const 시간초과 = (오류 as { name?: string })?.name === "TimeoutError";
    return 실패결과(공문, 접수, `${시간초과 ? "응답 시간 초과" : "서버에 연결하지 못함"} — 이 공문은 사람이 직접 확인해 주세요.`);
  }
}

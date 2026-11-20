// 공람 메일 내용 만들기 (PLAN.md 작업 14번 · DESIGN.md 4.3)
// 보내는 내용: 공문 제목·접수 정보, 판정 결과, 포함 사유, 근거 문장(3개 이내).
// 첨부 원문 전체는 담지 않는다. 화면의 미리보기와 서버 모의 발송이 같은 함수를 쓴다.

import type { JudgeResult } from "@/types";
import { MAX_EVIDENCES } from "../../types/index";

const 사유글: Record<string, string> = {
  "국무총리비서실": "국무총리비서실",
  "국무조정실": "국무조정실",
  "위원회-신설": "위원회(신설)",
  "위원회-기존": "위원회(기존)",
  "규제": "규제",
};

// 메일에 쓰는 판정 정보 (JudgeResult 중 필요한 부분)
export type 메일재료 = Pick<JudgeResult, "title" | "receivedInfo" | "verdict" | "reasons" | "evidences" | "failedFiles">;

export function composeMail(재료: 메일재료): { subject: string; body: string } {
  const 줄들: string[] = [
    `공문 제목: ${재료.title}`,
    `접수 정보: ${재료.receivedInfo}`,
    `판정 결과: ${재료.verdict} (확인을 돕는 참고 결과이며, 최종 판단은 담당자가 합니다)`,
  ];
  if (재료.reasons.length > 0) 줄들.push(`포함 사유: ${재료.reasons.map((사유) => 사유글[사유] ?? 사유).join(", ")}`);
  if (재료.failedFiles.length > 0) 줄들.push(`일부 읽기 실패: ${재료.failedFiles.join(", ")}`);

  const 근거들 = 재료.evidences.slice(0, MAX_EVIDENCES);
  if (근거들.length > 0) {
    줄들.push("", "근거 문장:");
    근거들.forEach((근거, 순서) => 줄들.push(`${순서 + 1}. ${근거.sentence} (${근거.fileName} · ${근거.position})`));
  }
  줄들.push("", "※ 실습용 모의 발송입니다. 실제로 메일이 전달되지 않습니다.");
  return { subject: `[공람] ${재료.title}`, body: 줄들.join("\n") };
}

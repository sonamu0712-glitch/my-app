// 공통 데이터 모양 (DESIGN.md 5번 · PLAN.md 작업 3번)
// 화면·서버·판정 코드가 모두 이 파일의 모양을 함께 쓴다.
// 가짜 공문·가상 조직도만 다루며, 공문 내용은 서버에 저장하지 않는다.

// 판정 결과: 세 가지 + 읽기 실패
// 안전 규칙: 글자를 못 읽은 공문은 절대 "없음"으로 처리하지 않는다.
export type Verdict = "포함" | "확인 필요" | "없음" | "읽기 실패";

// 포함 사유 (부총리는 대상이 아니므로 사유에 없다)
export type Reason =
  | "국무총리비서실"
  | "국무조정실"
  | "위원회-신설"
  | "위원회-기존"
  | "규제";

// 근거 문장 (위치는 쪽이 아니라 파일명과 문단 순서)
export interface Evidence {
  sentence: string; // 본문에서 그대로 가져온 문장
  fileName: string; // 첨부파일 이름
  position: string; // 예: "구역 1 · 문단 12"
}

// 근거 문장은 최대 3개까지만 보여준다.
export const MAX_EVIDENCES = 3;

// 공문 1건의 판정 결과
export interface JudgeResult {
  docId: string; // 공문 구분값 (폴더 이름 + 업로드 순번으로 만든다)
  title: string; // 공문 제목 (폴더 이름)
  receivedInfo: string; // 접수 정보 (업로드한 날짜·시각)
  verdict: Verdict;
  reasons: Reason[];
  evidences: Evidence[]; // 최대 3개. 없을 수 있음("확인 필요"인데 근거가 없는 경우)
  failedFiles: string[]; // 못 읽은 파일 이름. 비어 있지 않으면 "일부 읽기 실패" 꼬리표
  note?: string; // 사유 메모. 예: "AI 응답 시간 초과로 확인 필요 처리"
}

// 가상 조직도 담당자 (example.com 가상 주소만 사용)
export interface Officer {
  id: string;
  name: string; // 가짜 이름
  department: string;
  email: string | null; // 없으면 null
}

// 발송 기록 (공문 내용은 저장하지 않음. 브라우저에 저장)
export type SendStatus = "성공" | "실패" | "주소 없음";

export interface SendRecord {
  docId: string;
  officerId: string;
  sentAt: string; // ISO 시각
  status: SendStatus; // 실패 주소만 다시 보내기에 필요
}

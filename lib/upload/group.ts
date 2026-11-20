// 폴더로 올린 파일을 공문별로 묶고, 한도를 올리기 전에 확인한다 (PLAN.md 작업 10번 · DESIGN.md 3번·7.3)
// 규칙: 공문마다 폴더 하나, 폴더 이름이 공문 제목. 압축파일 업로드는 지원하지 않는다.
// - 하루치를 담은 상위 폴더를 고르면 그 아래 폴더들이 공문이 되고, 공문 폴더들을 직접 끌어놓으면 각 폴더가 공문이 된다.
// - 폴더에 묶이지 않은 파일은 조용히 버리지 않고 "묶음 오류"로 목록에 보여 준다.
// - 한도를 넘은 공문도 조용히 빼지 않고 이유와 함께 목록에 남긴다.
// 이 파일은 브라우저·서버 어디서나 쓸 수 있는 순수 계산이며 파일 내용은 읽지 않는다.

import { 최대공문수, 최대크기_바이트, 최대파일수 } from "./limits";

// 올릴 파일 하나 (path는 "폴더/하위폴더/파일.hwpx" 모양의 상대 경로)
export interface 올릴파일 {
  path: string;
  file: File;
}

// 공문 하나의 올리기 상태. "처리 대기"만 판정 단계로 넘어간다.
export type 올리기상태 = "처리 대기" | "크기 초과" | "파일 수 초과" | "건수 초과" | "묶음 오류";

export interface UploadDoc {
  docId: string; // 폴더 이름 + 업로드 순번
  title: string; // 폴더 이름
  files: { name: string; file: File }[]; // name은 공문 폴더 안쪽 경로
  totalSize: number;
  status: 올리기상태;
  note?: string; // 처리하지 않는 이유
}

// 공문 파일이 아닌 시스템·임시 파일은 무시한다.
function 무시할파일인가(이름: string): boolean {
  return 이름.startsWith(".") || 이름.startsWith("~$") || 이름 === "Thumbs.db" || 이름 === "desktop.ini";
}

const 묶이지않음_제목 = "(폴더에 묶이지 않은 파일)";

export function groupFolders(입력: 올릴파일[]): UploadDoc[] {
  const 파일들 = 입력.filter(({ path }) => !무시할파일인가(path.split("/").at(-1) ?? ""));
  const 조각들 = 파일들.map((칸) => ({ ...칸, 구간: 칸.path.split("/").filter((구간) => 구간 !== "") }));
  // 상위 폴더를 골랐는지: 3단계 이상 깊이가 있으면 두 번째 칸이 공문 폴더
  const 상위폴더모드 = 조각들.some((칸) => 칸.구간.length >= 3);

  const 공문들 = new Map<string, { name: string; file: File }[]>();
  const 묶이지않은: { name: string; file: File }[] = [];

  for (const { 구간, file } of 조각들) {
    if (구간.length <= 1 || (상위폴더모드 && 구간.length === 2)) {
      묶이지않은.push({ name: 구간.join("/"), file });
      continue;
    }
    const 폴더 = 상위폴더모드 ? 구간[1] : 구간[0];
    const 안쪽경로 = 구간.slice(상위폴더모드 ? 2 : 1).join("/");
    const 목록 = 공문들.get(폴더) ?? [];
    목록.push({ name: 안쪽경로, file });
    공문들.set(폴더, 목록);
  }

  const 결과: UploadDoc[] = [];
  const 오늘 = new Date();
  const 날짜글 = `${오늘.getFullYear()}${String(오늘.getMonth() + 1).padStart(2, "0")}${String(오늘.getDate()).padStart(2, "0")}`;
  let 순번 = 0;
  for (const [제목, 첨부들] of 공문들) {
    순번 += 1;
    const 합계 = 첨부들.reduce((합, 칸) => 합 + 칸.file.size, 0);
    const 공문: UploadDoc = {
      // 날짜를 앞에 붙여, 다른 날 올린 같은 이름·같은 순번 공문과 발송 기록이 섞이지 않게 한다 (작업 15번)
      docId: `${날짜글}-${String(순번).padStart(3, "0")}-${제목}`,
      title: 제목,
      files: 첨부들,
      totalSize: 합계,
      status: "처리 대기",
    };
    if (순번 > 최대공문수) {
      공문.status = "건수 초과";
      공문.note = `한 번에 올릴 수 있는 ${최대공문수}건을 넘었습니다. 나눠서 다시 올려 주세요.`;
    } else if (첨부들.length > 최대파일수) {
      공문.status = "파일 수 초과";
      공문.note = `첨부파일이 ${최대파일수}개를 넘었습니다. (${첨부들.length}개)`;
    } else if (합계 > 최대크기_바이트) {
      공문.status = "크기 초과";
      공문.note = `첨부 크기 합계가 한도(${최대크기_바이트 / 1024 / 1024}MB)를 넘었습니다.`;
    }
    결과.push(공문);
  }

  if (묶이지않은.length > 0) {
    결과.push({
      docId: `${날짜글}-000-묶이지-않은-파일`,
      title: 묶이지않음_제목,
      files: 묶이지않은,
      totalSize: 묶이지않은.reduce((합, 칸) => 합 + 칸.file.size, 0),
      status: "묶음 오류",
      note: "공문 폴더 안에 들어 있지 않은 파일입니다. 공문마다 폴더 하나로 묶어서 올려 주세요.",
    });
  }
  return 결과;
}

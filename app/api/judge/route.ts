// POST /api/judge — 공문 1건 판정 (DESIGN.md 6번)
// 입력: multipart/form-data — docId, title, receivedInfo(선택), files(첨부파일 여러 개)
// 출력: JudgeResult (JSON). 오류는 { error: { code, message } } 모양이며 공문 내용·키를 담지 않는다.
// 업로드된 파일 내용과 API 키는 로그에 남기지 않는다.

import { z } from "zod";
import type { JudgeResult } from "@/types";
import { judgeDocument } from "@/lib/judge/judge-document";
import { 최대파일수, 최대크기_바이트 } from "@/lib/upload/limits"; // 업로드 한도(잠정, DESIGN.md 7.3)

export const maxDuration = 30; // 배포 환경에서 최대 실행 시간(초). 판정 목표는 10초 안.

const 입력모양 = z.object({
  docId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  receivedInfo: z.string().max(100).optional(),
});

function 오류응답(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let 폼: FormData;
  try {
    폼 = await request.formData();
  } catch {
    return 오류응답("BAD_REQUEST", "요청 형식이 올바르지 않습니다.", 400);
  }

  const 입력 = 입력모양.safeParse({
    docId: 폼.get("docId"),
    title: 폼.get("title"),
    receivedInfo: 폼.get("receivedInfo") ?? undefined,
  });
  if (!입력.success) return 오류응답("INVALID_INPUT", "공문 구분값(docId)과 제목(title)이 필요합니다.", 400);

  const 파일들 = 폼.getAll("files").filter((값): 값 is File => typeof 값 !== "string");
  if (파일들.length > 최대파일수) return 오류응답("TOO_MANY_FILES", `첨부파일은 공문 1건당 ${최대파일수}개까지입니다.`, 400);
  const 전체크기 = 파일들.reduce((합, 파일) => 합 + 파일.size, 0);
  if (전체크기 > 최대크기_바이트) return 오류응답("TOO_LARGE", "공문 1건의 첨부 크기 합계가 한도(4MB)를 넘었습니다.", 413);

  try {
    const 첨부들 = await Promise.all(
      파일들.map(async (파일) => ({ name: 파일.name, bytes: new Uint8Array(await 파일.arrayBuffer()) }))
    );
    const 합친결과 = await judgeDocument(첨부들);
    const 결과: JudgeResult = {
      docId: 입력.data.docId,
      title: 입력.data.title,
      receivedInfo: 입력.data.receivedInfo ?? new Date().toISOString(),
      ...합친결과,
    };
    return Response.json(결과);
  } catch {
    // 내용을 남기지 않는다. 판정을 못 했으므로 "없음"이 아니라 오류로 알린다.
    return 오류응답("JUDGE_FAILED", "판정 중 문제가 생겼습니다. 이 공문은 사람이 직접 확인해 주세요.", 500);
  }
}

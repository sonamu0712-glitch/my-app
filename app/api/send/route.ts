// POST /api/send — 공람 모의 발송 (DESIGN.md 6번)
// 안전 규칙: "사람이 확인했다"(confirmed: true)는 값이 있어야만 동작하고, 판정이 "포함"·"확인 필요"가 아니면 거절한다.
// 실제 메일은 보내지 않는다(모의). 서버는 기록을 저장하지 않고, 공문 내용·받는 사람 주소를 로그에 남기지 않는다.
// 입력: JSON { docId, title, receivedInfo, verdict, reasons, evidences, failedFiles, confirmed, recipientIds? }
//   recipientIds를 빼면 조직도 전체에게, 넣으면 그 담당자들에게만 보낸다(실패한 주소만 다시 보내기용).
// 출력: { mock: true, docId, results: [{ officerId, status }] }

import { z } from "zod";
import { getOfficers } from "@/lib/org/load";
import { mockSend } from "@/lib/send/mock-send";

const 입력모양 = z.object({
  docId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  receivedInfo: z.string().max(100),
  verdict: z.enum(["포함", "확인 필요", "없음", "읽기 실패"]),
  reasons: z.array(z.enum(["국무총리비서실", "국무조정실", "위원회-신설", "위원회-기존", "규제"])).max(5),
  evidences: z.array(z.object({ sentence: z.string().max(1000), fileName: z.string().max(300), position: z.string().max(100) })).max(3),
  failedFiles: z.array(z.string().max(300)).max(50),
  confirmed: z.boolean(),
  recipientIds: z.array(z.string()).max(500).optional(),
});

function 오류응답(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let 본문: unknown;
  try {
    본문 = await request.json();
  } catch {
    return 오류응답("BAD_REQUEST", "요청 형식이 올바르지 않습니다.", 400);
  }

  const 입력 = 입력모양.safeParse(본문);
  if (!입력.success) return 오류응답("INVALID_INPUT", "보낼 내용의 모양이 올바르지 않습니다.", 400);
  const { verdict, confirmed, recipientIds } = 입력.data;

  // 사람이 확인하지 않았으면 보내지 않는다 (자동 발송 금지)
  if (!confirmed) return 오류응답("NOT_CONFIRMED", "담당자가 확인한 뒤에만 발송할 수 있습니다.", 400);
  // "포함"·"확인 필요"만 공람 대상이다
  if (verdict !== "포함" && verdict !== "확인 필요") {
    return 오류응답("NOT_SENDABLE", `판정이 "${verdict}"인 공문은 공람 발송 대상이 아닙니다.`, 400);
  }

  let 담당자들;
  try {
    담당자들 = getOfficers();
  } catch {
    return 오류응답("ORG_INVALID", "가상 조직도를 불러오지 못했습니다.", 500);
  }

  let 받는사람들 = 담당자들;
  if (recipientIds) {
    const 목록 = new Map(담당자들.map((칸) => [칸.id, 칸]));
    if (recipientIds.some((id) => !목록.has(id))) return 오류응답("UNKNOWN_RECIPIENT", "조직도에 없는 받는 사람이 있습니다.", 400);
    받는사람들 = [...new Set(recipientIds)].map((id) => 목록.get(id)!);
  }
  if (받는사람들.length === 0) return 오류응답("NO_RECIPIENT", "받는 사람이 없습니다.", 400);

  return Response.json({ mock: true, docId: 입력.data.docId, results: mockSend(받는사람들) });
}

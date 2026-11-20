// 첨부파일 1개 읽기 + 읽기 실패 분류 (PLAN.md 작업 6번)
// 안전 규칙: 글자를 읽지 못한 파일은 "읽기 실패"로 기록하고, 절대 "없음"으로 처리하지 않는다.
// 이 파일은 읽기만 한다. "일부 읽기 실패" 때문에 판정을 최소 "확인 필요"로 올리는 일은 판정 합치기(작업 9번)에서 한다.
// 파일 내용은 로그에 남기지 않는다.

import JSZip from "jszip";
import { extractHwpx, type TextUnit } from "./extract";

// 읽지 못한 이유 (화면과 사유 메모에 그대로 보여줄 말)
export type FailReason =
  | "암호가 걸린 파일"
  | "이전 형식(.hwp)"
  | "PDF (이번 버전에서는 읽지 않음)"
  | "글자를 찾지 못함 (스캔본·그림만 있는 파일일 수 있음)"
  | "손상된 파일"
  | "지원하지 않는 파일 형식";

// 첨부파일 1개의 읽기 결과
export type FileReadResult =
  | { ok: true; fileName: string; units: TextUnit[] }
  | { ok: false; fileName: string; reason: FailReason };

// 파일 앞부분(매직 바이트)으로 종류를 짐작한다. 이름만 믿지 않기 위함.
function 앞부분이같은가(바이트: Uint8Array, 기대: number[]): boolean {
  return 기대.every((값, 순서) => 바이트[순서] === 값);
}
const 이전형식_머리 = [0xd0, 0xcf, 0x11, 0xe0]; // 옛 한글(.hwp)·옛 오피스 파일
const PDF_머리 = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function 실패(fileName: string, reason: FailReason): FileReadResult {
  return { ok: false, fileName, reason };
}

// 첨부파일 1개를 읽는다. 어떤 경우에도 오류를 밖으로 던지지 않고, 성공/실패로 돌려준다.
export async function readAttachment(
  fileName: string,
  내용: ArrayBuffer | Uint8Array
): Promise<FileReadResult> {
  const 바이트 = 내용 instanceof Uint8Array ? 내용 : new Uint8Array(내용);
  const 소문자이름 = fileName.toLowerCase();

  // 1) 이름 또는 파일 앞부분으로 읽지 않는 형식을 먼저 가려낸다.
  if (소문자이름.endsWith(".pdf") || 앞부분이같은가(바이트, PDF_머리)) return 실패(fileName, "PDF (이번 버전에서는 읽지 않음)");
  if (소문자이름.endsWith(".hwp") || 앞부분이같은가(바이트, 이전형식_머리)) return 실패(fileName, "이전 형식(.hwp)");
  if (!소문자이름.endsWith(".hwpx")) return 실패(fileName, "지원하지 않는 파일 형식");

  // 2) HWPX: 압축 파일로 열리는지 본다.
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(바이트);
  } catch {
    return 실패(fileName, "손상된 파일");
  }

  // 3) 암호 표시가 있으면 읽지 않는다. (HWPX는 manifest.xml에 암호화 정보가 들어간다)
  try {
    const 목록 = await zip.file("META-INF/manifest.xml")?.async("string");
    if (목록 && /encryption-data/i.test(목록)) return 실패(fileName, "암호가 걸린 파일");
  } catch {
    return 실패(fileName, "손상된 파일");
  }

  // 4) 본문 글자를 뽑는다. 읽다가 오류가 나면 손상으로 본다.
  try {
    const { units } = await extractHwpx(바이트, fileName);
    // 글자가 하나도 없으면 "없음"이 아니라 읽기 실패다. (스캔본·그림만 있는 파일)
    if (units.length === 0) return 실패(fileName, "글자를 찾지 못함 (스캔본·그림만 있는 파일일 수 있음)");
    return { ok: true, fileName, units };
  } catch {
    return 실패(fileName, "손상된 파일");
  }
}

// 한 공문의 첨부파일 읽기 결과를 합친다.
export interface AttachmentSummary {
  units: TextUnit[]; // 읽은 글자(성공한 파일 전부)
  failedFiles: string[]; // 못 읽은 파일 이름
  failReasons: { fileName: string; reason: FailReason }[];
  allFailed: boolean; // 읽은 파일이 하나도 없음 → 공문 판정은 "읽기 실패"
}

export function summarizeAttachments(결과들: FileReadResult[]): AttachmentSummary {
  const units: TextUnit[] = [];
  const failReasons: { fileName: string; reason: FailReason }[] = [];
  for (const 결과 of 결과들) {
    if (결과.ok) units.push(...결과.units);
    else failReasons.push({ fileName: 결과.fileName, reason: 결과.reason });
  }
  return {
    units,
    failedFiles: failReasons.map((실패값) => 실패값.fileName),
    failReasons,
    // 첨부가 0개인 경우도 읽은 것이 없으므로 읽기 실패로 본다.
    allFailed: 결과들.every((결과) => !결과.ok),
  };
}

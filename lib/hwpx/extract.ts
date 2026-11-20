// HWPX 본문 글자 읽기 (PLAN.md 작업 4번)
// HWPX는 압축 파일(zip)이고, 본문은 Contents/section0.xml, section1.xml … 안에 들어 있다.
// 여기서는 본문 문단의 글자만 뽑는다. 머리말·꼬리말·각주·미주는 읽지 않는다. (PRD 확정 사항)
// 표 안의 글자(칸 안 문단)도 읽는다. (작업 5번) 표 속 문단의 위치는 "구역 N · 문단 M · 표"처럼 표가 든 문단 번호 뒤에 "표"를 붙인다.
// 근거 위치는 쪽이 아니라 "구역 N · 문단 M" (HWPX에는 쪽 번호가 글에 저장되지 않음).
// 파일 내용은 로그에 남기지 않는다.

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

// 문단 하나에서 뽑은 글자와 위치
export interface TextUnit {
  text: string; // 문단의 글자 (여러 글조각을 이어 붙인 것)
  fileName: string; // 첨부파일 이름
  position: string; // 예: "구역 1 · 문단 12"
}

export interface ExtractResult {
  units: TextUnit[];
  tableCount: number; // 읽은 표 개수 (참고용)
}

// 읽지 않는 영역: 머리말·꼬리말·각주·미주 (본문이 아님)
const 읽지않는태그 = new Set(["header", "footer", "footNote", "endNote"]);

// fast-xml-parser의 순서 유지(preserveOrder) 노드: { "태그이름": [자식들], ":@": 속성 }
type XmlNode = Record<string, unknown>;

// "hp:p" → "p" (접두어 제거)
function 짧은이름(태그: string): string {
  const 위치 = 태그.indexOf(":");
  return 위치 >= 0 ? 태그.slice(위치 + 1) : 태그;
}

// 노드의 태그 이름 (":@"는 속성 칸이라 제외)
function 태그이름(노드: XmlNode): string | null {
  return Object.keys(노드).find((키) => 키 !== ":@") ?? null;
}

// 노드 안의 자식 노드 목록
function 자식들(노드: XmlNode): XmlNode[] {
  const 태그 = 태그이름(노드);
  if (!태그) return [];
  const 값 = 노드[태그];
  return Array.isArray(값) ? (값 as XmlNode[]) : [];
}

// 읽는 도중 모으는 값: 표 개수, 표 안 문단의 글자
interface 집계값 {
  표개수: number;
  표글자: string[]; // 표 칸 안 문단들의 글자 (칸 순서대로)
}

// 문단 안에서 글자를 모은다. 글조각(t)의 글자만 이어 붙이고,
// 머리말·각주 등은 들어가지 않으며, 표 칸 안 문단의 글자는 집계.표글자에 따로 모은다.
function 글자모으기(노드들: XmlNode[], 집계: 집계값): string {
  let 글 = "";
  for (const 노드 of 노드들) {
    const 이름 = 태그이름(노드);
    if (!이름) continue; // "#text" 같은 노드는 글조각 안에서만 읽는다
    const 짧은 = 짧은이름(이름);
    if (짧은 === "t") {
      글 += 글조각읽기(자식들(노드));
    } else if (짧은 === "tbl") {
      집계.표개수 += 1;
      표읽기(자식들(노드), 집계);
    } else if (읽지않는태그.has(짧은)) {
      continue; // 머리말·꼬리말·각주·미주는 읽지 않는다
    } else {
      글 += 글자모으기(자식들(노드), 집계); // run, ctrl 등은 안쪽을 계속 본다
    }
  }
  return 글;
}

// 표 안을 행(tr) → 칸(tc) → 칸 안 목록(subList) → 문단(p) 순서로 따라가며 글자를 모은다.
// 칸 안에 또 표가 있어도 글자모으기가 다시 이 함수를 불러 끝까지 읽는다.
function 표읽기(노드들: XmlNode[], 집계: 집계값): void {
  for (const 노드 of 노드들) {
    const 이름 = 태그이름(노드);
    if (!이름) continue;
    const 짧은 = 짧은이름(이름);
    if (짧은 === "p") {
      const 글 = 글자모으기(자식들(노드), 집계).trim();
      if (글 !== "") 집계.표글자.push(글);
    } else if (짧은 === "tr" || 짧은 === "tc" || 짧은 === "subList") {
      표읽기(자식들(노드), 집계);
    }
  }
}

// 글조각(t) 안: 글자는 그대로, 줄바꿈·탭 표시는 띄어쓰기로
function 글조각읽기(노드들: XmlNode[]): string {
  let 글 = "";
  for (const 노드 of 노드들) {
    const 이름 = 태그이름(노드);
    if (이름 === "#text") {
      글 += String(노드["#text"] ?? "");
    } else if (이름) {
      const 짧은 = 짧은이름(이름);
      if (짧은 === "lineBreak" || 짧은 === "tab") 글 += " ";
    }
  }
  return 글;
}

// section 파일 이름의 번호 (section0.xml → 0)
function 구역번호(경로: string): number | null {
  const 일치 = 경로.match(/^Contents\/section(\d+)\.xml$/);
  return 일치 ? Number(일치[1]) : null;
}

// HWPX 파일(바이트)에서 본문 글자를 뽑는다. 읽을 수 없으면 오류를 던진다(분류는 작업 6번).
export async function extractHwpx(
  파일: ArrayBuffer | Uint8Array,
  fileName: string
): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(파일);

  const 구역들 = Object.keys(zip.files)
    .map((경로) => ({ 경로, 번호: 구역번호(경로) }))
    .filter((구역): 구역 is { 경로: string; 번호: number } => 구역.번호 !== null)
    .sort((가, 나) => 가.번호 - 나.번호);

  if (구역들.length === 0) {
    throw new Error("본문 파일(Contents/section*.xml)이 없습니다.");
  }

  // 태그 안 글자가 숫자로 바뀌지 않게(parseTagValue) 하고, 공백도 그대로 둔다(trimValues).
  const 해석기 = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: false,
  });

  const units: TextUnit[] = [];
  const 집계: 집계값 = { 표개수: 0, 표글자: [] };

  for (let 순서 = 0; 순서 < 구역들.length; 순서++) {
    const 구역 = 구역들[순서];
    const 내용 = await zip.file(구역.경로)!.async("string");
    const 문서 = 해석기.parse(내용) as XmlNode[];

    // 본문 문단(p)은 구역 뿌리(sec) 바로 아래에 있다.
    const 뿌리 = 문서.find((노드) => 태그이름(노드) !== null && 짧은이름(태그이름(노드)!) === "sec");
    if (!뿌리) throw new Error(`${구역.경로}에서 본문(sec)을 찾지 못했습니다.`);

    let 문단번호 = 0;
    for (const 노드 of 자식들(뿌리)) {
      const 이름 = 태그이름(노드);
      if (!이름 || 짧은이름(이름) !== "p") continue;
      문단번호 += 1;
      집계.표글자 = [];
      const 글 = 글자모으기(자식들(노드), 집계).trim();
      const 위치 = `구역 ${순서 + 1} · 문단 ${문단번호}`;
      // 빈 문단은 번호만 세고 결과에는 넣지 않는다
      if (글 !== "") units.push({ text: 글, fileName, position: 위치 });
      // 이 문단에 든 표 속 글자
      for (const 표글 of 집계.표글자) units.push({ text: 표글, fileName, position: `${위치} · 표` });
    }
  }

  return { units, tableCount: 집계.표개수 };
}

// 단어 규칙 판정 (DESIGN.md 4.1 ② · PLAN.md 작업 7번)
// AI 없이, 정해 둔 단어로만 "총리실 업무가 있는지" 1차로 살핀다. 결과는 판정 합치기(작업 9번)가 AI 결과와 합친다.
// - 공백·줄바꿈을 없앤 글자에서 찾으므로 "규제 특례", "규제샌드 / 박스"처럼 나뉘어도 찾는다.
// - 부총리가 나온 문장은 근거로 쓰지 않는다. 질서위반행위(과태료)만 있는 규제 문장은 규제로 보지 않는다.
// - 단어 규칙은 "없음"을 확정하지 못한다. 걸린 게 없다는 뜻일 뿐이며, 읽기 실패 처리는 따로 한다.
// 파일 내용은 로그에 남기지 않는다.

import type { Evidence, Reason } from "@/types";
import type { TextUnit } from "@/lib/hwpx/extract";
import {
  비서실단어, 조정실단어, 총리단어, 위원회단어, 총리소속단어들, 신설단어들,
  규제강한단어들, 규제단어, 질서위반단어들, 부총리단어,
} from "./keywords";

// 단어 규칙이 알려주는 최소 판정 (이보다 낮게 내려가지 않는다는 뜻)
export type RuleLevel = "없음" | "확인 필요" | "포함";

export interface RuleResult {
  reasons: Reason[]; // 단어로 확인된 포함 사유
  evidences: Evidence[]; // 근거 후보 (우선순위 순, 부총리 문장 제외). 3개로 줄이는 일은 합치기에서 한다.
  level: RuleLevel; // 단어만 봤을 때의 최소 판정
  hints: { 위원회: boolean; 규제: boolean; 총리언급: boolean }; // AI·합치기가 참고할 단서
}

// 문장 하나와 그 문단 안의 위치
interface 문장 {
  text: string;
  start: number; // 문단 글자 속 시작 위치
  end: number;
}

// 문단을 문장으로 나눈다. 마침표·물음표·느낌표 뒤에 공백이 오거나 끝날 때만 자른다.
function 문장나누기(글: string): 문장[] {
  const 결과: 문장[] = [];
  let 시작 = 0;
  const 자르는곳 = /[.!?]+(?=\s|$)/g;
  let 일치: RegExpExecArray | null;
  while ((일치 = 자르는곳.exec(글)) !== null) {
    const 끝 = 일치.index + 일치[0].length;
    결과.push({ text: 글.slice(시작, 끝).trim(), start: 시작, end: 끝 });
    시작 = 끝;
  }
  if (시작 < 글.length) 결과.push({ text: 글.slice(시작).trim(), start: 시작, end: 글.length });
  return 결과.filter((문) => 문.text !== "");
}

const 공백없애기 = (글: string) => 글.replace(/\s+/g, "");
const 포함하는가 = (글: string, 단어들: string[]) => 단어들.some((단어) => 글.includes(단어));

// 한 군데에서 찾은 결과
interface 발견 {
  단어: string;
  unitIndex: number;
  sentence: 문장;
}

// 같은 파일의 문단들을 이어 붙인 글(공백 제거)에서 단어를 찾는다. 문단 사이에 걸쳐 나뉜 단어도 찾는다.
// 찾은 위치는 "단어가 시작하는 문단의 문장"으로 돌려준다.
function 단어찾기(units: TextUnit[], 단어들: string[]): 발견[] {
  const 발견들: 발견[] = [];
  // 파일별로 묶는다 (파일 사이에 걸친 단어는 찾지 않는다)
  const 파일별 = new Map<string, number[]>();
  units.forEach((단위, 순서) => {
    const 목록 = 파일별.get(단위.fileName) ?? [];
    목록.push(순서);
    파일별.set(단위.fileName, 목록);
  });

  for (const 순서들 of 파일별.values()) {
    let 이은글 = "";
    const 지도: { unitIndex: number; 글자위치: number }[] = []; // 이은 글의 각 글자가 어느 문단 몇 번째 글자인지
    for (const 순서 of 순서들) {
      const 원문 = units[순서].text;
      for (let i = 0; i < 원문.length; i++) {
        if (/\s/.test(원문[i])) continue;
        이은글 += 원문[i];
        지도.push({ unitIndex: 순서, 글자위치: i });
      }
    }
    for (const 단어 of 단어들) {
      let 위치 = 이은글.indexOf(단어);
      while (위치 !== -1) {
        const { unitIndex, 글자위치 } = 지도[위치];
        const 문장들 = 문장나누기(units[unitIndex].text);
        const 해당 = 문장들.find((문) => 글자위치 >= 문.start && 글자위치 < 문.end) ?? 문장들[0];
        if (해당) 발견들.push({ 단어, unitIndex, sentence: 해당 });
        위치 = 이은글.indexOf(단어, 위치 + 1);
      }
    }
  }
  return 발견들;
}

// 단어 규칙 판정
export function judgeByRules(units: TextUnit[]): RuleResult {
  const 근거후보: { 순위: number; 증거: Evidence }[] = [];
  const 보인것 = new Set<string>();
  const 사유 = new Set<Reason>();
  const 힌트 = { 위원회: false, 규제: false, 총리언급: false };
  let 최소: RuleLevel = "없음";
  const 올리기 = (수준: RuleLevel) => {
    const 서열: RuleLevel[] = ["없음", "확인 필요", "포함"];
    if (서열.indexOf(수준) > 서열.indexOf(최소)) 최소 = 수준;
  };

  // 근거 후보 담기: 부총리 문장은 근거로 쓰지 않고, 같은 문장은 한 번만 담는다.
  const 근거담기 = (찾음: 발견, 순위: number) => {
    if (찾음.sentence.text.includes(부총리단어)) return;
    const 단위 = units[찾음.unitIndex];
    const 열쇠 = `${단위.fileName}|${단위.position}|${찾음.sentence.text}`;
    if (보인것.has(열쇠)) return;
    보인것.add(열쇠);
    근거후보.push({ 순위, 증거: { sentence: 찾음.sentence.text, fileName: 단위.fileName, position: 단위.position } });
  };

  // 1) 국무총리비서실 · 국무조정실 → 포함 (부총리 문장이어도 사유는 인정하되 근거로는 쓰지 않는다)
  const 비서실 = 단어찾기(units, [비서실단어]);
  const 조정실 = 단어찾기(units, [조정실단어]);
  if (비서실.length > 0) 사유.add("국무총리비서실");
  if (조정실.length > 0) 사유.add("국무조정실");
  [...비서실, ...조정실].forEach((찾음) => 근거담기(찾음, 1));
  if (비서실.length + 조정실.length > 0) 올리기("포함");

  // 2) 위원회: 국무총리 소속이면 포함(신설/기존 구분), 그 밖의 위원회는 확인 필요
  const 위원회찾음 = 단어찾기(units, [위원회단어]);
  if (위원회찾음.length > 0) {
    힌트.위원회 = true;
    // 같은 파일 안에서 위원회 문장에 신설·설치 표현이 있는지 (제목 문장 포함)
    const 위원회문장 = 위원회찾음.map((찾음) => ({ 찾음, 글: 공백없애기(찾음.sentence.text) }));
    const 신설인가 = 위원회문장.some(({ 글 }) => 포함하는가(글, 신설단어들));
    const 소속찾음 = 위원회문장.filter(({ 글 }) => 포함하는가(글, 총리소속단어들));
    if (소속찾음.length > 0) {
      사유.add(신설인가 ? "위원회-신설" : "위원회-기존");
      소속찾음.forEach(({ 찾음 }) => 근거담기(찾음, 2));
      올리기("포함");
    } else {
      // 소속을 알 수 없는 위원회: 놓치지 않도록 확인 필요
      위원회문장.forEach(({ 찾음 }) => 근거담기(찾음, 4));
      올리기("확인 필요");
    }
  }

  // 3) 규제: 강한 단어는 반드시 찾고, "규제"만 있는 문장은 질서위반행위·과태료 문장이면 제외
  const 강한찾음 = 단어찾기(units, 규제강한단어들);
  const 일반찾음 = 단어찾기(units, [규제단어]).filter(
    (찾음) => !포함하는가(공백없애기(찾음.sentence.text), 질서위반단어들)
  );
  if (강한찾음.length + 일반찾음.length > 0) {
    힌트.규제 = true;
    사유.add("규제");
    강한찾음.forEach((찾음) => 근거담기(찾음, 3));
    일반찾음.forEach((찾음) => 근거담기(찾음, 5));
    올리기("확인 필요");
  }

  // 4) "국무총리"만 언급: 사유로 확정하지 않고 확인 필요 단서로만 쓴다. (부총리는 이 단어를 포함하지 않는다)
  const 총리찾음 = 단어찾기(units, [총리단어]);
  if (총리찾음.length > 0) {
    힌트.총리언급 = true;
    총리찾음.forEach((찾음) => 근거담기(찾음, 6));
    // 위원회 소속 문장에서 이미 포함으로 올린 경우가 아니면 확인 필요
    올리기("확인 필요");
  }

  const 순서대로 = 근거후보.sort((가, 나) => 가.순위 - 나.순위).map((칸) => 칸.증거);
  return { reasons: [...사유], evidences: 순서대로, level: 최소, hints: 힌트 };
}

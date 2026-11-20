// 시험용 가짜 공문(HWPX) 만들기 — PLAN.md 작업 1번, DESIGN.md 10.2 "가짜 공문 구성"
//
// 실행: npm run samples
// 결과: samples/ 아래에 공문 폴더(공문 1건 = 폴더 1개)와 정답표.json이 만들어진다.
//
// 주의
// - 모든 내용은 지어낸 가짜 문장이다. 실제 공문·실제 직원 정보는 쓰지 않는다.
// - HWPX의 최소한의 구조(압축 파일 안에 XML)만 흉내 낸 것이라, 한글 프로그램에서 열리는지는
//   확인하지 않았다. 실제 구조와 맞는지는 한글로 직접 만든 샘플로 따로 확인해야 한다(DESIGN 10.2).
// - 이미 있는 파일은 덮어쓰고, 삭제는 하지 않는다.

import JSZip from "jszip";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const 루트 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const 출력폴더 = path.join(루트, "samples");

// ───────────────────────── HWPX 만들기 ─────────────────────────

// XML에 넣을 수 없는 글자를 바꾼다.
function 이스케이프(글) {
  return 글
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

let 문단번호 = 1000;

// 문단 하나. 안쪽 조각(글, 표, 머리말 등)은 run 하나에 담는다.
function 문단(안쪽) {
  문단번호 += 1;
  return (
    `<hp:p id="${문단번호}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="0">${안쪽}</hp:run></hp:p>`
  );
}

function 글조각(글) {
  return `<hp:t>${이스케이프(글)}</hp:t>`;
}

// 머리말·각주·표 칸 안쪽에 들어가는 문단 묶음
function 하위목록(글들) {
  return (
    `<hp:subList id="0" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" ` +
    `linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
    글들.map((글) => 문단(글조각(글))).join("") +
    `</hp:subList>`
  );
}

function 머리말(글) {
  return `<hp:ctrl><hp:header id="1" applyPageType="BOTH">${하위목록([글])}</hp:header></hp:ctrl>`;
}

function 각주(글) {
  return `<hp:ctrl><hp:footNote number="1" suffixChar="41" instId="1">${하위목록([글])}</hp:footNote></hp:ctrl>`;
}

function 표(칸들) {
  // 칸들: 2차원 배열 [행][열] = 글
  const 행수 = 칸들.length;
  const 열수 = Math.max(...칸들.map((행) => 행.length));
  const 행들 = 칸들
    .map(
      (행, r) =>
        `<hp:tr>` +
        행
          .map(
            (글, c) =>
              `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="1">` +
              하위목록([글]) +
              `<hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/>` +
              `<hp:cellSz width="8000" height="1000"/></hp:tc>`,
          )
          .join("") +
        `</hp:tr>`,
    )
    .join("");
  return `<hp:tbl id="1" rowCnt="${행수}" colCnt="${열수}" cellSpacing="0" borderFillIDRef="1" noAdjust="0">${행들}</hp:tbl>`;
}

const 이름공간 =
  'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" ' +
  'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" ' +
  'xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" ' +
  'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"';

// 파일 한 개의 내용 모양
// {
//   본문: ["문단1", "문단2"],        본문 글자
//   표: [["칸", "칸"], ["칸", "칸"]],  본문 속 표 (선택)
//   머리말: "글", 각주: "글",         읽지 않아야 하는 글자 (선택)
//   그림만: true,                     글자 없이 그림만 있는 스캔본 흉내 (선택)
//   암호: true,                       암호 파일 흉내 (선택)
// }
async function hwpx만들기(내용) {
  const zip = new JSZip();

  // HWPX 규칙: mimetype 파일이 맨 앞에 있고 압축하지 않는다.
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  zip.file(
    "version.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
      '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" targetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="0" os="1" xmlVersion="1.2" application="가상 샘플 생성기" appVersion="0.1"/>',
  );
  zip.file(
    "META-INF/container.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
      '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container"><ocf:rootfiles>' +
      '<ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>',
  );

  // 암호 파일 흉내: 암호화 정보가 들어 있고 본문은 읽을 수 없는 바이트로 채운다.
  const 매니페스트 = 내용.암호
    ? '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
      '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">' +
      '<odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml">' +
      '<odf:encryption-data odf:checksum-type="SHA1"/></odf:file-entry></odf:manifest>'
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
      '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>';
  zip.file("META-INF/manifest.xml", 매니페스트);

  zip.file(
    "Contents/content.hpf",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' +
      '<opf:package xmlns:opf="http://www.idpf.org/2007/opf/" version="" unique-identifier="" id="">' +
      "<opf:metadata><opf:title>가상 공문</opf:title></opf:metadata><opf:manifest>" +
      '<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>' +
      '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>' +
      '</opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>',
  );
  zip.file(
    "Contents/header.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hh:head ${이름공간} version="1.4" secCnt="1"/>`,
  );

  if (내용.암호) {
    // 같은 값이 항상 나오도록 고정된 규칙으로 만든 의미 없는 바이트
    const 바이트 = Buffer.alloc(256);
    let 값 = 7;
    for (let i = 0; i < 바이트.length; i += 1) {
      값 = (값 * 131 + 17) % 251;
      바이트[i] = 값;
    }
    zip.file("Contents/section0.xml", 바이트);
  } else {
    const 문단들 = [];
    if (내용.그림만) {
      // 글자 없이 그림 자리만 있는 문단 (스캔본 흉내)
      문단들.push(문단('<hp:pic id="1" reverse="0"><hp:img binaryItemIDRef="image1"/></hp:pic>'));
    } else {
      (내용.본문 ?? []).forEach((글, 순서) => {
        let 안쪽 = "";
        // 머리말은 구역의 첫 문단에 붙는 것이 실제 구조와 비슷하다.
        if (순서 === 0 && 내용.머리말) 안쪽 += 머리말(내용.머리말);
        안쪽 += 글조각(글);
        // 각주는 마지막 본문 문단 끝에 붙인다.
        if (순서 === (내용.본문?.length ?? 0) - 1 && 내용.각주) 안쪽 += 각주(내용.각주);
        문단들.push(문단(안쪽));
      });
      if (내용.표) 문단들.push(문단(표(내용.표)));
    }
    zip.file(
      "Contents/section0.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec ${이름공간}>${문단들.join("")}</hs:sec>`,
    );
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ───────────────────────── 가짜 공문 목록 ─────────────────────────

// 총리실과 관련 없는 평범한 붙임 파일 (공문마다 첨부가 약 3개라는 PRD 기준을 맞추기 위한 채움용)
const 붙임_서식 = { 본문: ["붙임 서식 안내", "제출 서식은 가상부처 누리집에서 내려받아 사용하시기 바랍니다."] };
const 붙임_참고 = { 본문: ["참고 자료", "지난해 행사 참석 현황은 별도 표와 같습니다. 문의처는 가상부처 총무과입니다."] };

// 만든 파일 모양: { 이름, 종류: "hwpx" | "원본", 내용 | 바이트 }
const hwpx파일 = (이름, 내용) => ({ 이름, 종류: "hwpx", 내용 });
const 원본파일 = (이름, 바이트) => ({ 이름, 종류: "원본", 바이트 });

// 허용판정: 이 공문이 받아야 하는 판정(여러 개면 그중 하나면 정답)
// 사유: 결과에 표시돼야 하는 포함 사유
const 공문들 = [
  {
    폴더: "01_비서실_업무요청",
    설명: "국무총리비서실 업무가 본문에 있음",
    허용판정: ["포함"],
    사유: ["국무총리비서실"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "가상부처 정책 추진 현황 보고 요청",
          "국무총리비서실에서 요청한 정책 추진 현황을 아래와 같이 제출하여 주시기 바랍니다.",
          "제출 기한은 이번 달 말일입니다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "02_조정실_협조요청",
    설명: "국무조정실 업무가 본문에 있음",
    허용판정: ["포함"],
    사유: ["국무조정실"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: ["부처 간 협업 과제 협조 요청", "국무조정실 주관 점검 회의에 관계 부서가 참석하여 주시기 바랍니다."],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "03_위원회_신설",
    설명: "국무총리 소속 위원회를 새로 둔다는 내용",
    허용판정: ["포함"],
    사유: ["위원회-신설"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "가상정책위원회 설치에 관한 법률안 입법예고",
          "국무총리 소속으로 가상정책위원회를 둔다.",
          "위원회는 위원장 1명을 포함한 9명의 위원으로 구성한다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "04_위원회_기존_운영",
    설명: "이미 있는 국무총리 소속 위원회의 회의 안내",
    허용판정: ["포함"],
    사유: ["위원회-기존"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "가상정책위원회 제3차 회의 개최 안내",
          "국무총리 소속 가상정책위원회 제3차 회의를 아래와 같이 개최합니다.",
          "안건: 지난 회의 결과 보고 및 향후 운영 계획",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "05_행정규제기본법_규제",
    설명: "행정규제기본법에 따른 규제(허가 요건 신설)와 규제영향분석",
    허용판정: ["확인 필요", "포함"],
    사유: ["규제"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "가상 시설 설치 허가 요건 개정안 협의 요청",
          "이 개정안은 행정규제기본법에 따른 규제에 해당하며 규제영향분석서를 첨부합니다.",
          "신규 설치 시 사전 허가를 받아야 합니다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "06_규제특례",
    설명: "규제특례라는 단어가 있음",
    허용판정: ["확인 필요", "포함"],
    사유: ["규제"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: ["신기술 실증 사업 안내", "실증 사업자에게는 규제특례를 적용할 수 있습니다."],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "07_규제샌드박스",
    설명: "규제샌드박스라는 단어가 있음",
    허용판정: ["확인 필요", "포함"],
    사유: ["규제"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: ["신산업 시험 사업 공모", "규제샌드박스 제도를 활용한 시험 사업자를 공모합니다."],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "08_나뉜_단어",
    설명: "규제특례·규제샌드박스가 띄어쓰기나 줄바꿈으로 나뉘어 있음",
    허용판정: ["확인 필요", "포함"],
    사유: ["규제"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "시범 사업 참여 안내",
          "참여 기관에는 규제 특례를 적용합니다.",
          "또한 규제샌드",
          "박스 신청 절차는 별도로 안내합니다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "09_질서위반행위만",
    설명: "질서위반행위(과태료)만 있고 총리실·규제 내용은 없음",
    허용판정: ["없음"],
    사유: [],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "과태료 부과 기준 안내",
          "질서위반행위에 대한 과태료 부과 기준과 이의 제기 절차는 아래와 같습니다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "10_부총리만",
    설명: "부총리만 나오고 국무총리·비서실·조정실은 없음",
    허용판정: ["없음"],
    사유: [],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: ["경제 현안 점검 회의 개최", "부총리 주재로 경제 현안 점검 회의를 개최합니다."],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "11_부총리와_총리실_함께",
    설명: "부총리 문장과 국무총리비서실 문장이 함께 있음 (부총리 문장은 근거로 쓰면 안 됨)",
    허용판정: ["포함"],
    사유: ["국무총리비서실"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "점검 회의 결과 공유",
          "부총리 주재 점검 회의 결과를 공유합니다.",
          "국무총리비서실에 후속 조치 계획을 보고하여 주시기 바랍니다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "12_머리말_각주에만",
    설명: "총리실 내용이 머리말·각주에만 있고 본문은 무관함 (읽지 않으므로 없음이 정답)",
    허용판정: ["없음"],
    사유: [],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: ["행사 참석 안내", "다음 달 행사에 참석할 인원을 알려 주시기 바랍니다."],
        머리말: "국무총리비서실 협조 문서",
        각주: "국무조정실 관련 참고 사항",
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "13_표_안에만",
    설명: "총리실 내용이 본문 속 표 안에만 있음 (표는 읽어야 함)",
    허용판정: ["포함", "확인 필요"],
    사유: ["국무조정실"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: ["과제별 담당 기관 안내", "과제별 담당 기관은 아래 표와 같습니다."],
        표: [
          ["과제", "담당 기관"],
          ["부처 간 협업 과제", "국무조정실"],
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "14_무관한_문서",
    설명: "총리실과 아무 관련 없는 문서",
    허용판정: ["없음"],
    사유: [],
    파일: [
      hwpx파일("붙임1.hwpx", { 본문: ["직원 체육대회 안내", "다음 달 둘째 주 금요일에 직원 체육대회를 엽니다."] }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "15_일부_읽기실패",
    설명: "첨부 3개 중 1개만 못 읽고 나머지는 무관함 (없음이 아니라 최소 확인 필요)",
    허용판정: ["확인 필요"],
    사유: [],
    파일: [
      hwpx파일("붙임1.hwpx", { 본문: ["직원 교육 일정 안내", "교육 일정은 붙임 서식을 참고하시기 바랍니다."] }),
      원본파일("붙임2.hwpx", Buffer.from("이 파일은 HWPX 압축 파일이 아닌 손상된 파일입니다.", "utf8")),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "16_암호_파일",
    설명: "암호가 걸린 파일 흉내 (읽기 실패)",
    허용판정: ["읽기 실패"],
    사유: [],
    파일: [hwpx파일("붙임1.hwpx", { 암호: true })],
  },
  {
    폴더: "17_이전형식_hwp",
    설명: "이전 형식 .hwp 파일 흉내 (읽기 실패)",
    허용판정: ["읽기 실패"],
    사유: [],
    // 이전 형식 한글 파일(.hwp)의 첫 바이트 모양(복합 문서 머리글)만 흉내 낸 가짜 파일
    파일: [원본파일("붙임1.hwp", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]))],
  },
  {
    폴더: "18_pdf_첨부",
    설명: "pdf 첨부 (이번에는 읽지 않으므로 읽기 실패)",
    허용판정: ["읽기 실패"],
    사유: [],
    파일: [원본파일("붙임1.pdf", Buffer.from("%PDF-1.4\n% 가상 샘플\n%%EOF\n", "utf8"))],
  },
  {
    폴더: "19_스캔본_그림만",
    설명: "글자 없이 그림만 있는 스캔본 흉내 (읽기 실패)",
    허용판정: ["읽기 실패"],
    사유: [],
    파일: [hwpx파일("붙임1.hwpx", { 그림만: true })],
  },
  {
    폴더: "20_손상_파일",
    설명: "HWPX가 아닌 손상된 파일 하나뿐 (읽기 실패)",
    허용판정: ["읽기 실패"],
    사유: [],
    파일: [원본파일("붙임1.hwpx", Buffer.from("손상된 파일", "utf8"))],
  },
  {
    폴더: "21_위원회_신설과_규제",
    설명: "위원회 신설과 규제가 함께 있음",
    허용판정: ["포함"],
    사유: ["위원회-신설", "규제"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "가상규제점검위원회 설치 및 규제 정비 계획",
          "국무총리 소속으로 가상규제점검위원회를 설치한다.",
          "위원회는 행정규제기본법에 따른 규제 정비 과제를 심의한다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "22_두번째_첨부에만",
    설명: "총리실 내용이 두 번째 첨부에만 있음",
    허용판정: ["포함"],
    사유: ["국무총리비서실"],
    파일: [
      hwpx파일("붙임1.hwpx", { 본문: ["업무 협조 요청", "자세한 내용은 붙임 문서를 참고하시기 바랍니다."] }),
      hwpx파일("붙임2.hwpx", {
        본문: ["보고 대상 안내", "이 사업의 추진 상황은 국무총리비서실에 월 1회 보고합니다."],
      }),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "23_다른_부처_위원회",
    설명: "국무총리 소속이 아닌 위원회 이야기 (위원회 단서가 보이므로 최소 확인 필요)",
    허용판정: ["확인 필요", "포함"],
    사유: [],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: ["자문위원회 개최 안내", "가상부처 소속 자문위원회 회의를 아래와 같이 개최합니다."],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
  {
    폴더: "24_규제_완화_과태료_함께",
    설명: "규제샌드박스와 과태료가 함께 있음 (과태료는 무시하고 규제샌드박스는 찾아야 함)",
    허용판정: ["확인 필요", "포함"],
    사유: ["규제"],
    파일: [
      hwpx파일("붙임1.hwpx", {
        본문: [
          "시험 사업 운영 기준",
          "규제샌드박스 승인 사업자는 변경 사항을 신고하여야 한다.",
          "신고하지 않은 경우 질서위반행위로 보아 과태료를 부과한다.",
        ],
      }),
      hwpx파일("붙임2.hwpx", 붙임_서식),
      hwpx파일("붙임3.hwpx", 붙임_참고),
    ],
  },
];

// ───────────────────────── 만들고 확인하기 ─────────────────────────

async function 만들기() {
  await mkdir(출력폴더, { recursive: true });
  let 파일수 = 0;

  for (const 공문 of 공문들) {
    const 폴더 = path.join(출력폴더, 공문.폴더);
    await mkdir(폴더, { recursive: true });
    for (const 파일 of 공문.파일) {
      const 내용 = 파일.종류 === "hwpx" ? await hwpx만들기(파일.내용) : 파일.바이트;
      await writeFile(path.join(폴더, 파일.이름), 내용);
      파일수 += 1;
    }
  }

  // 정답표: 나중에 정답률·누락률을 잴 때 쓴다 (PLAN 작업 16)
  const 정답표 = {
    설명: "시험용 가짜 공문의 정답표입니다. 허용판정 중 하나가 나오면 정답으로 봅니다.",
    주의: "모든 내용은 지어낸 가짜입니다. HWPX는 최소 구조만 흉내 낸 것이라 한글 프로그램에서 열리는지는 확인하지 않았습니다.",
    공문: 공문들.map((공문) => ({
      폴더: 공문.폴더,
      설명: 공문.설명,
      허용판정: 공문.허용판정,
      사유: 공문.사유,
      파일: 공문.파일.map((파일) => 파일.이름),
    })),
  };
  await writeFile(path.join(출력폴더, "정답표.json"), `${JSON.stringify(정답표, null, 2)}\n`);

  return 파일수;
}

// 만든 HWPX가 압축 파일로 열리고 필수 파일이 있는지 다시 열어 확인한다.
async function 확인하기() {
  const 문제 = [];
  let 확인한수 = 0;

  for (const 공문 of 공문들) {
    for (const 파일 of 공문.파일) {
      if (파일.종류 !== "hwpx") continue;
      const 바이트 = await readFile(path.join(출력폴더, 공문.폴더, 파일.이름));
      let zip;
      try {
        zip = await JSZip.loadAsync(바이트);
      } catch {
        문제.push(`${공문.폴더}/${파일.이름}: 압축 파일로 열리지 않음`);
        continue;
      }
      확인한수 += 1;
      const 이름들 = Object.keys(zip.files);
      if (이름들[0] !== "mimetype") 문제.push(`${공문.폴더}/${파일.이름}: mimetype이 맨 앞에 없음`);
      if (!zip.file("Contents/section0.xml")) 문제.push(`${공문.폴더}/${파일.이름}: section0.xml 없음`);
    }
  }

  // 정답표에 적은 폴더가 실제로 있는지도 확인
  const 폴더들 = (await readdir(출력폴더, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const 공문 of 공문들) {
    if (!폴더들.includes(공문.폴더)) 문제.push(`${공문.폴더}: 폴더가 없음`);
  }
  return { 문제, 확인한수 };
}

const 파일수 = await 만들기();
const { 문제, 확인한수 } = await 확인하기();

console.log(`가짜 공문 ${공문들.length}건, 파일 ${파일수}개를 samples/ 에 만들었습니다.`);
console.log(`HWPX ${확인한수}개를 다시 열어 구조를 확인했습니다.`);
if (문제.length > 0) {
  console.log("문제가 있습니다:");
  for (const 줄 of 문제) console.log(`  - ${줄}`);
  process.exitCode = 1;
} else {
  console.log("문제 없음. 정답표: samples/정답표.json");
}

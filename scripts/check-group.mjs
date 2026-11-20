// 폴더 묶음·한도 확인 스크립트 (작업 10번). 실행: npm run check-group
import { groupFolders } from "../lib/upload/group.ts";

const 파일 = (경로, 크기 = 1000) => ({ path: 경로, file: new File([new Uint8Array(크기)], 경로.split("/").at(-1)) });
let 실패 = 0;
function 확인(설명, 조건) { console.log(`${조건 ? "○" : "✕"} ${설명}`); if (!조건) 실패++; }

// 1) 상위 폴더 하나를 고른 경우 + 폴더 밖 파일 + 시스템 파일
let r = groupFolders([파일("하루치/공문A/붙임1.hwpx"), 파일("하루치/공문A/붙임2.hwpx"), 파일("하루치/공문B/붙임1.hwpx"), 파일("하루치/낱개.hwpx"), 파일("하루치/공문A/.DS_Store")]);
확인("상위 폴더: 공문 2건 + 묶음 오류 1건", r.length === 3 && r[0].title === "공문A" && r[0].files.length === 2 && r[2].status === "묶음 오류");
확인("공문 구분값에 날짜·순번·폴더 이름이 붙음", /^\d{8}-001-공문A$/.test(r[0].docId) && /^\d{8}-002-공문B$/.test(r[1].docId));
// 2) 공문 폴더들을 직접 끌어놓은 경우
r = groupFolders([파일("공문A/붙임1.hwpx"), 파일("공문B/붙임1.hwpx")]);
확인("공문 폴더 직접: 2건, 모두 처리 대기", r.length === 2 && r.every((칸) => 칸.status === "처리 대기"));
// 3) 한도
r = groupFolders([파일("상위/큰공문/a.hwpx", 5 * 1024 * 1024)]);
확인("크기 초과(5MB)", r[0].status === "크기 초과");
r = groupFolders(Array.from({ length: 11 }, (_, i) => 파일(`상위/많은공문/${i}.hwpx`)));
확인("파일 수 초과(11개)", r[0].status === "파일 수 초과");
r = groupFolders(Array.from({ length: 102 }, (_, i) => 파일(`상위/공문${i}/a.hwpx`)));
확인("건수 초과: 100건까지 대기, 나머지 2건은 건수 초과", r.filter((칸) => 칸.status === "처리 대기").length === 100 && r.filter((칸) => 칸.status === "건수 초과").length === 2);
// 4) 하위 폴더가 있는 공문
r = groupFolders([파일("상위/공문A/부록/붙임1.hwpx"), 파일("상위/공문A/본문.hwpx")]);
확인("공문 안 하위 폴더 파일도 같은 공문", r.length === 1 && r[0].files.length === 2);
// 5) 이름 확인: 한도 초과 공문이 목록에서 사라지지 않음
확인("한도 초과 공문도 목록에 남음", groupFolders([파일("상위/큰공문/a.hwpx", 5 * 1024 * 1024)]).length === 1);
console.log(실패 === 0 ? "\n문제 없음" : `\n실패 ${실패}개`);
process.exit(실패 ? 1 : 0);

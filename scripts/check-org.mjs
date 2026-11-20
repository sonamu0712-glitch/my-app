// 가상 조직도 확인 스크립트 (작업 13번). 실행: npm run check-org
import { readFileSync } from "node:fs";

const 파일 = JSON.parse(readFileSync(new URL("../data/org-chart.sample.json", import.meta.url), "utf8"));
const 담당자들 = 파일.담당자;
let 실패 = 0;
const 확인 = (설명, 조건) => { console.log(`${조건 ? "○" : "✕"} ${설명}`); if (!조건) 실패++; };

확인(`담당자 ${담당자들.length}명`, 담당자들.length >= 10);
확인("id가 모두 다름", new Set(담당자들.map((칸) => 칸.id)).size === 담당자들.length);
const 주소있음 = 담당자들.filter((칸) => 칸.email !== null);
const 정상주소 = 주소있음.filter((칸) => /^[^@\s]+@example\.com$/.test(칸.email));
확인("정상 주소는 모두 example.com", 정상주소.every((칸) => 칸.email.endsWith("@example.com")));
확인("실제 도메인 주소가 하나도 없음 (형식 오류용 1개 제외)", 주소있음.every((칸) => !칸.email.includes("@") || 칸.email.endsWith("@example.com")));
확인("시험용: 주소 없음 담당자 있음", 담당자들.some((칸) => 칸.email === null));
확인("시험용: 발송 실패용 bounce 주소 있음", 담당자들.some((칸) => 칸.email === "bounce@example.com"));
확인("시험용: 주소 형식 오류 담당자 있음", 담당자들.some((칸) => 칸.email && !칸.email.includes("@")));
console.log(실패 === 0 ? "\n문제 없음" : `\n실패 ${실패}개`);
process.exit(실패 ? 1 : 0);

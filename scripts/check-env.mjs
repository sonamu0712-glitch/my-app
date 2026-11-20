// .env에 필요한 비밀 값이 있는지 "값 있음 / 값 없음"으로만 알려주는 스크립트
// 값 자체는 절대 출력하지 않는다. 실행: npm run check-env
import { readFileSync } from "node:fs";

// 이 앱에서 쓰는 이름들 (현재 앱 코드가 쓰는 것은 OPENAI_API_KEY)
const 확인할이름 = ["OPENAI_API_KEY", "GITHUB_TOKEN", "VERCEL_TOKEN", "SUPABASE_ACCESS_TOKEN"];

let 내용 = "";
try {
  내용 = readFileSync(new URL("../.env", import.meta.url), "utf8");
} catch {
  console.log(".env 파일이 없습니다.");
  process.exit(1);
}

// 이름=값 줄만 읽어 값이 비어 있는지만 본다.
const 값있는이름 = new Set();
for (const 줄 of 내용.split(/\r?\n/)) {
  const 일치 = 줄.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (일치 && 일치[2].trim() !== "") 값있는이름.add(일치[1]);
}

let 빠진것 = 0;
for (const 이름 of 확인할이름) {
  const 있음 = 값있는이름.has(이름);
  if (!있음) 빠진것++;
  console.log(`${이름}: ${있음 ? "값 있음" : "값 없음"}`);
}

// NEXT_PUBLIC_ 이름은 브라우저로 새어 나가므로 쓰면 안 된다.
const 공개이름 = [...값있는이름].filter((이름) => 이름.startsWith("NEXT_PUBLIC_"));
if (공개이름.length > 0) console.log(`주의: NEXT_PUBLIC_ 이름이 있습니다 → ${공개이름.join(", ")}`);

process.exit(빠진것 > 0 ? 1 : 0);

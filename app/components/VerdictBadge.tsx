// 판정 배지 (포함 · 확인 필요 · 없음 · 읽기 실패는 별도 색) — DESIGN.md 3.1
import type { Verdict } from "@/types";

const 판정색: Record<Verdict, string> = {
  "포함": "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
  "확인 필요": "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  "없음": "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  "읽기 실패": "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100",
};

export default function VerdictBadge({ verdict, large = false }: { verdict: Verdict; large?: boolean }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-medium ${large ? "text-base" : "text-xs"} ${판정색[verdict]}`}>
      {verdict}
    </span>
  );
}

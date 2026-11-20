"use client";

// 공문 목록 (DESIGN.md 3번 ③) — 판정별 필터, 먼저 끝난 공문부터 표시 (PLAN.md 작업 12번)
import { useState } from "react";
import type { JudgeResult, SendRecord, Verdict } from "@/types";
import { sendState } from "@/lib/send/history";
import VerdictBadge from "./VerdictBadge";

type 필터값 = "전체" | Verdict;
const 필터들: 필터값[] = ["전체", "포함", "확인 필요", "없음", "읽기 실패"];

// 목록 한 줄의 발송 여부 표시
function 발송표시({ 상태 }: { 상태: ReturnType<typeof sendState> }) {
  if (상태.종류 === "발송 완료") return <span className="text-xs font-medium text-green-700 dark:text-green-400">발송 완료</span>;
  if (상태.종류 === "일부 실패") return <span className="text-xs font-medium text-amber-700 dark:text-amber-400">발송 일부 실패</span>;
  return <span className="text-xs text-zinc-500">미발송</span>;
}

export default function ResultList({
  결과들,
  기록들,
  선택됨,
  onSelect,
}: {
  결과들: JudgeResult[];
  기록들: SendRecord[];
  선택됨: string | null;
  onSelect: (docId: string) => void;
}) {
  const [필터, set필터] = useState<필터값>("전체");
  const 개수 = (값: 필터값) => (값 === "전체" ? 결과들.length : 결과들.filter((결과) => 결과.verdict === 값).length);
  const 보이는것 = 필터 === "전체" ? 결과들 : 결과들.filter((결과) => 결과.verdict === 필터);

  return (
    <section aria-label="공문 목록" className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-2 text-lg font-semibold">공문 목록</h2>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="판정별 필터">
        {필터들.map((값) => (
          <button
            key={값}
            type="button"
            onClick={() => set필터(값)}
            aria-pressed={필터 === 값}
            className={`rounded-full border px-3 py-1 text-sm ${필터 === 값 ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300 dark:border-zinc-600"}`}
          >
            {값} {개수(값)}
          </button>
        ))}
      </div>

      {결과들.length === 0 ? (
        <p className="text-sm text-zinc-500">판정이 끝난 공문이 여기에 나타납니다.</p>
      ) : 보이는것.length === 0 ? (
        <p className="text-sm text-zinc-500">이 판정의 공문이 없습니다.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-zinc-200 overflow-auto rounded border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
          {보이는것.map((결과) => (
            <li key={결과.docId}>
              <button
                type="button"
                onClick={() => onSelect(결과.docId)}
                aria-current={선택됨 === 결과.docId}
                className={`flex w-full flex-wrap items-center gap-2 p-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${선택됨 === 결과.docId ? "bg-blue-50 dark:bg-blue-950" : ""}`}
              >
                <span className="flex-1 break-all">{결과.title}</span>
                <VerdictBadge verdict={결과.verdict} />
                {결과.failedFiles.length > 0 && 결과.verdict !== "읽기 실패" && (
                  <span className="text-xs text-red-600 dark:text-red-400">일부 읽기 실패</span>
                )}
                <발송표시 상태={sendState(기록들, 결과.docId)} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

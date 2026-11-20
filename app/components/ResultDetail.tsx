// 공문 상세 (DESIGN.md 3번 ④) — 판정·사유·근거 문장·안내 문구 (PLAN.md 작업 12번)
// 원문 전체는 보여주지 않고, 근거 문장(3개 이내)과 파일명·위치만 보여 준다.
// [공람 발송] 버튼은 "포함"·"확인 필요"일 때만 눌 수 있고, 누르면 확인 창이 열린다. (작업 14번)
"use client";

import { useState } from "react";
import type { JudgeResult, Reason, SendRecord, SendStatus } from "@/types";
import { sendState } from "@/lib/send/history";
import VerdictBadge from "./VerdictBadge";
import SendDialog from "./SendDialog";

// 사유 이름을 화면용으로 바꾼다 (위원회는 신설/기존을 괄호로 구분)
const 사유글: Record<Reason, string> = {
  "국무총리비서실": "국무총리비서실",
  "국무조정실": "국무조정실",
  "위원회-신설": "위원회(신설)",
  "위원회-기존": "위원회(기존)",
  "규제": "규제",
};

// 접수 시각을 "2026. 11. 20. 오후 2:49:17"처럼 읽기 쉽게 보여 준다. 시각 모양이 아니면 받은 글 그대로 보여 준다.
function 읽기쉬운시각(글: string): string {
  const 시각 = new Date(글);
  return Number.isNaN(시각.getTime()) ? 글 : 시각.toLocaleString("ko-KR");
}

export default function ResultDetail({
  결과,
  기록들,
  onSent,
}: {
  결과: JudgeResult | null;
  기록들: SendRecord[];
  onSent: (docId: string, 결과들: { officerId: string; status: SendStatus }[]) => void;
}) {
  const [창열림, set창열림] = useState(false);
  const 발송가능 = 결과?.verdict === "포함" || 결과?.verdict === "확인 필요";
  const 상태 = 결과 ? sendState(기록들, 결과.docId) : null;
  const 완료 = 상태?.종류 === "발송 완료";

  return (
    <section aria-label="공문 상세" className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-2 text-lg font-semibold">공문 상세</h2>
      {!결과 ? (
        <p className="text-sm text-zinc-500">목록에서 공문을 고르면 판정, 사유, 근거 문장이 여기에 나타납니다.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="break-all font-medium">{결과.title}</p>
            <p className="text-xs text-zinc-500">접수 {읽기쉬운시각(결과.receivedInfo)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={결과.verdict} large />
            {결과.failedFiles.length > 0 && 결과.verdict !== "읽기 실패" && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900 dark:text-red-100">일부 읽기 실패</span>
            )}
          </div>

          {결과.failedFiles.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">읽지 못한 파일</p>
              <ul className="list-disc pl-5 text-red-700 dark:text-red-400">
                {결과.failedFiles.map((이름) => (
                  <li key={이름} className="break-all">{이름}</li>
                ))}
              </ul>
            </div>
          )}

          {결과.reasons.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 font-medium">포함 사유</p>
              <ul className="flex flex-wrap gap-2">
                {결과.reasons.map((사유) => (
                  <li key={사유} className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-600">{사유글[사유]}</li>
                ))}
              </ul>
            </div>
          )}

          {(결과.verdict === "포함" || 결과.verdict === "확인 필요") && (
            <div className="text-sm">
              <p className="mb-1 font-medium">근거 문장 ({결과.evidences.length}개)</p>
              {결과.evidences.length > 0 ? (
                <ul className="space-y-2">
                  {결과.evidences.map((근거, 순서) => (
                    <li key={순서} className="rounded bg-zinc-100 p-2 dark:bg-zinc-800">
                      <p>{근거.sentence}</p>
                      <p className="mt-1 text-xs text-zinc-500">{근거.fileName} · {근거.position}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">찾은 근거 문장이 없습니다. 아래 사유 메모를 확인해 주세요.</p>
              )}
            </div>
          )}

          {결과.note && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              <span className="font-medium">사유 메모: </span>{결과.note}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => set창열림(true)}
              disabled={!발송가능 || 완료}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {완료 ? "발송 완료" : 상태?.종류 === "일부 실패" ? "실패한 주소 다시 보내기" : "공람 발송"}
            </button>
            {상태?.종류 === "발송 완료" && <p className="mt-1 text-xs text-green-700 dark:text-green-400">이미 발송했습니다. 중복 발송을 막기 위해 다시 보내지 않습니다.</p>}
            {상태?.종류 === "일부 실패" && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">발송했지만 {상태.실패한사람.length}명의 주소가 실패했습니다.</p>}
            {!발송가능 && <p className="mt-1 text-xs text-zinc-500">판정이 &ldquo;포함&rdquo; 또는 &ldquo;확인 필요&rdquo;인 공문만 공람 발송할 수 있습니다.</p>}
          </div>
          {창열림 && <SendDialog key={결과.docId} 결과={결과} 기록들={기록들} onSent={onSent} onClose={() => set창열림(false)} />}

          <p className="text-xs text-zinc-500">
            원문 전체는 보여주지 않습니다. 최종 판단은 담당자가 합니다. 이 판정은 확인을 돕는 참고 결과입니다.
          </p>
        </div>
      )}
    </section>
  );
}

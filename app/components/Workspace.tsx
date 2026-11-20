"use client";

// 한 화면 안의 공유 상태: 업로드 영역이 만든 판정 결과와 브라우저에 저장된 발송 기록을 목록·상세가 함께 본다
// (PLAN.md 작업 12·15번)
import { useState } from "react";
import type { JudgeResult } from "@/types";
import UploadPanel from "./UploadPanel";
import ResultList from "./ResultList";
import ResultDetail from "./ResultDetail";
import { useSendRecords } from "./useSendRecords";

export default function Workspace() {
  const [결과들, set결과들] = useState<JudgeResult[]>([]);
  const [선택한id, set선택한id] = useState<string | null>(null);
  const { 기록들, 저장실패, 기록추가 } = useSendRecords();
  // 새 목록을 올려 결과가 비워지면 선택도 자연스럽게 사라진다
  const 선택됨 = 결과들.find((결과) => 결과.docId === 선택한id) ?? null;

  return (
    <>
      {저장실패 && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">
          이 브라우저에 발송 기록을 저장하지 못했습니다. 이 창을 닫으면 중복 발송을 막을 수 없으니 이미 보낸 공문을 따로 적어 두세요.
        </p>
      )}
      <UploadPanel onResultsChange={set결과들} />
      <div className="grid gap-4 md:grid-cols-2">
        <ResultList 결과들={결과들} 기록들={기록들} 선택됨={선택됨?.docId ?? null} onSelect={set선택한id} />
        <ResultDetail 결과={선택됨} 기록들={기록들} onSent={기록추가} />
      </div>
    </>
  );
}

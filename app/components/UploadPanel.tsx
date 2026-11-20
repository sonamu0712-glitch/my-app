"use client";

// 업로드 영역 (PLAN.md 작업 10번 · DESIGN.md 3번 ②)
// 공문 폴더를 여러 개 고르거나 끌어놓으면 공문별로 묶고, 크기·개수 한도를 올리기 전에 알려 준다.
// [판정 시작]을 누르면 "처리 대기" 공문을 몇 건씩 동시에 판정 API로 보내고(작업 11번), "N건 중 M건 완료"를 보여 준다.
// 한 건에 문제가 생겨도 그 건만 "읽기 실패"로 표시하고 나머지는 계속한다. (공문 목록·상세 화면은 작업 12번)
// 파일 내용은 화면에도 로그에도 남기지 않는다(이름·크기만 다룬다).

import { useEffect, useRef, useState } from "react";
import type { JudgeResult } from "@/types";
import { judgeOne } from "@/lib/upload/judge-client";
import { runWithLimit } from "@/lib/upload/queue";
import VerdictBadge from "./VerdictBadge";
import { groupFolders, type UploadDoc, type 올릴파일 } from "@/lib/upload/group";
import { readDroppedItems } from "@/lib/upload/read-dropped";
import { 최대공문수, 최대크기_바이트, 최대파일수 } from "@/lib/upload/limits";

const 크기글 = (바이트: number) => (바이트 >= 1024 * 1024 ? `${(바이트 / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(바이트 / 1024))}KB`);

// 동시에 처리하는 공문 수 (AI 서비스·서버에 무리가 가지 않도록 적당히)
const 동시개수 = 5;

export default function UploadPanel({ onResultsChange }: { onResultsChange?: (결과들: JudgeResult[]) => void }) {
  const [공문들, set공문들] = useState<UploadDoc[]>([]);
  const [끄는중, set끄는중] = useState(false);
  const [읽는중, set읽는중] = useState(false);
  const 입력칸 = useRef<HTMLInputElement>(null);
  const [결과들, set결과들] = useState<Record<string, JudgeResult>>({});
  const [처리중, set처리중] = useState<string[]>([]); // 지금 판정 중인 docId
  const [진행중, set진행중] = useState(false);
  const [경과초, set경과초] = useState(0);
  const 실행번호 = useRef(0); // 새 목록을 받으면 이전 실행의 결과가 섞이지 않게 한다

  // 판정 결과가 바뀔 때마다 목록·상세 화면에 알린다 (끝난 순서대로 들어 있다)
  useEffect(() => {
    onResultsChange?.(Object.values(결과들));
  }, [결과들, onResultsChange]);

  // 처리하는 동안 경과 시간을 1초마다 올린다
  useEffect(() => {
    if (!진행중) return;
    const 시작 = Date.now();
    const 타이머 = setInterval(() => set경과초(Math.floor((Date.now() - 시작) / 1000)), 1000);
    return () => clearInterval(타이머);
  }, [진행중]);

  function 받기(파일들: 올릴파일[]) {
    실행번호.current += 1; // 진행 중이던 처리는 더 새 건을 시작하지 않는다
    set결과들({});
    set처리중([]);
    set진행중(false);
    set경과초(0);
    set공문들(groupFolders(파일들));
  }

  // 판정 시작: "처리 대기" 공문만 몇 건씩 동시에 보낸다. 끝나는 대로 결과가 채워진다.
  async function 판정시작() {
    const 이번실행 = ++실행번호.current;
    const 대상 = 공문들.filter((공문) => 공문.status === "처리 대기");
    const 접수 = new Date().toISOString();
    set결과들({});
    set경과초(0);
    set진행중(true);
    await runWithLimit(
      대상,
      동시개수,
      async (공문) => {
        set처리중((앞) => [...앞, 공문.docId]);
        const 결과 = await judgeOne(공문, 접수);
        if (실행번호.current !== 이번실행) return;
        set결과들((앞) => ({ ...앞, [공문.docId]: 결과 }));
        set처리중((앞) => 앞.filter((값) => 값 !== 공문.docId));
      },
      () => 실행번호.current !== 이번실행
    );
    if (실행번호.current === 이번실행) set진행중(false);
  }

  // 폴더 선택 창으로 고른 경우
  function 고름(이벤트: React.ChangeEvent<HTMLInputElement>) {
    const 목록 = Array.from(이벤트.target.files ?? []);
    받기(목록.map((file) => ({ path: file.webkitRelativePath || file.name, file })));
    이벤트.target.value = ""; // 같은 폴더를 다시 골라도 반응하도록 비운다
  }

  // 폴더를 끌어놓은 경우
  async function 놓음(이벤트: React.DragEvent<HTMLDivElement>) {
    이벤트.preventDefault();
    set끄는중(false);
    set읽는중(true);
    try {
      받기(await readDroppedItems(이벤트.dataTransfer.items));
    } finally {
      set읽는중(false);
    }
  }

  const 대기 = 공문들.filter((공문) => 공문.status === "처리 대기");
  const 제외 = 공문들.filter((공문) => 공문.status !== "처리 대기");
  const 완료수 = 대기.filter((공문) => 결과들[공문.docId]).length;
  const 시작했나 = 진행중 || 완료수 > 0;
  const 전부끝남 = 대기.length > 0 && 완료수 === 대기.length;

  return (
    <section aria-label="공문 올리기" className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-2 text-lg font-semibold">공문 올리기</h2>

      <div
        onDragOver={(이벤트) => { 이벤트.preventDefault(); set끄는중(true); }}
        onDragLeave={() => set끄는중(false)}
        onDrop={놓음}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center ${끄는중 ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-zinc-300 dark:border-zinc-600"}`}
      >
        <p>공문 폴더들을 여기에 끌어놓거나, 아래 버튼으로 고르세요.</p>
        <button
          type="button"
          onClick={() => 입력칸.current?.click()}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          공문 폴더 선택
        </button>
        {/* 폴더 선택: 하루치를 담은 상위 폴더 하나를 고르면 그 아래 폴더들이 공문이 된다. */}
        <input
          ref={입력칸}
          type="file"
          multiple
          className="hidden"
          aria-label="공문 폴더 선택"
          onChange={고름}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />
        {읽는중 && <p role="status">폴더를 읽는 중입니다…</p>}
      </div>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>공문마다 폴더 하나로 묶어 주세요. 폴더 이름이 공문 제목이 됩니다. (압축 파일은 올릴 수 없습니다)</li>
        <li>한도: 공문 1건당 첨부 {최대파일수}개 · 합계 {최대크기_바이트 / 1024 / 1024}MB 이하, 한 번에 {최대공문수}건까지. 넘는 공문은 목록에 이유와 함께 표시되고 처리하지 않습니다.</li>
        <li>한도 숫자는 잠정값이며, 배포 환경에서 확인한 뒤 확정합니다.</li>
      </ul>

      {공문들.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 font-medium" role="status">
            공문 {공문들.length}건 확인 — 처리 대기 {대기.length}건
            {제외.length > 0 && <span className="text-red-600 dark:text-red-400"> · 처리하지 않음 {제외.length}건</span>}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={판정시작}
              disabled={진행중 || 대기.length === 0}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {진행중 ? "판정 중…" : 전부끝남 ? "다시 판정" : "판정 시작"}
            </button>
            {시작했나 && (
              <div className="min-w-60 flex-1">
                <p role="status" className="text-sm font-medium">
                  {대기.length}건 중 {완료수}건 완료 · 경과 {Math.floor(경과초 / 60)}분 {경과초 % 60}초
                </p>
                <progress className="h-2 w-full" max={대기.length} value={완료수} aria-label="판정 진행" />
              </div>
            )}
          </div>
          <div className="max-h-80 overflow-auto rounded border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="p-2">공문(폴더 이름)</th>
                  <th className="p-2">파일 수</th>
                  <th className="p-2">크기</th>
                  <th className="p-2">상태</th>
                  <th className="p-2">판정</th>
                </tr>
              </thead>
              <tbody>
                {공문들.map((공문) => (
                  <tr key={공문.docId} className="border-t border-zinc-200 dark:border-zinc-700">
                    <td className="p-2">{공문.title}</td>
                    <td className="p-2">{공문.files.length}개</td>
                    <td className="p-2">{크기글(공문.totalSize)}</td>
                    <td className="p-2">
                      <span className={공문.status === "처리 대기" ? "text-green-700 dark:text-green-400" : "font-medium text-red-600 dark:text-red-400"}>
                        {공문.status}
                      </span>
                      {공문.note && <span className="block text-xs text-zinc-600 dark:text-zinc-400">{공문.note}</span>}
                    </td>
                    <td className="p-2">
                      {결과들[공문.docId] ? (
                        <>
                          <VerdictBadge verdict={결과들[공문.docId].verdict} />
                          {결과들[공문.docId].failedFiles.length > 0 && 결과들[공문.docId].verdict !== "읽기 실패" && (
                            <span className="ml-1 text-xs text-red-600 dark:text-red-400">일부 읽기 실패</span>
                          )}
                        </>
                      ) : 처리중.includes(공문.docId) ? (
                        <span className="text-xs text-zinc-500">판정 중…</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => 받기([])}
            disabled={진행중}
            className="mt-2 text-sm text-zinc-600 underline disabled:no-underline disabled:opacity-50 dark:text-zinc-400"
          >
            목록 비우기
          </button>
        </div>
      )}
    </section>
  );
}

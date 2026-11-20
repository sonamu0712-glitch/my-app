"use client";

// 공람 확인 창 + 발송 결과 (DESIGN.md 3번 ⑤ · PLAN.md 작업 14·15번)
// 사람이 [공람 발송]을 눌러 이 창이 열리고, 내용을 확인한 뒤 [확인하고 발송]을 눌러야만 서버로 보낸다. 자동 발송은 없다.
// 중복 방지(작업 15번): 이 브라우저에 발송 기록이 있는 공문은 다시 보내지 않는다.
//   다만 일부 주소가 "실패"였다면 그 실패한 주소에게만 다시 보낼 수 있다.
import { useEffect, useRef, useState } from "react";
import type { JudgeResult, Officer, SendRecord, SendStatus } from "@/types";
import { composeMail } from "@/lib/send/compose";
import { loadRecords, sendState } from "@/lib/send/history";

type 단계 = "불러오는중" | "확인" | "보내는중" | "결과" | "오류";
interface 결과칸 { officerId: string; status: SendStatus }

export default function SendDialog({
  결과,
  기록들,
  onSent,
  onClose,
}: {
  결과: JudgeResult;
  기록들: SendRecord[];
  onSent: (docId: string, 결과들: 결과칸[]) => void;
  onClose: () => void;
}) {
  const 창 = useRef<HTMLDialogElement>(null);
  const [단계, set단계] = useState<단계>("불러오는중");
  const [담당자들, set담당자들] = useState<Officer[]>([]);
  const [발송결과, set발송결과] = useState<결과칸[]>([]);
  const [다시보냄, set다시보냄] = useState(false);
  const [오류글, set오류글] = useState("");

  // 창을 열고, 가상 조직도를 불러온다
  useEffect(() => {
    창.current?.showModal();
    let 취소됨 = false;
    (async () => {
      try {
        const 응답 = await fetch("/api/org");
        if (!응답.ok) throw new Error();
        const 목록 = (await 응답.json()) as Officer[];
        if (!취소됨) { set담당자들(목록); set단계("확인"); }
      } catch {
        if (!취소됨) { set오류글("가상 조직도를 불러오지 못했습니다."); set단계("오류"); }
      }
    })();
    return () => { 취소됨 = true; };
  }, []);

  // Esc 키 등 어떤 방법으로 창이 닫혀도 화면에서 없애, 다음에 다시 열 수 있게 한다
  useEffect(() => {
    const 요소 = 창.current;
    if (!요소) return;
    // Esc 키는 먼저 cancel 이벤트를 낸다. 직접 닫으면 close 이벤트가 이어서 나므로 둘 다 듣는다.
    const 취소됨 = (이벤트: Event) => {
      이벤트.preventDefault();
      onClose();
    };
    요소.addEventListener("cancel", 취소됨);
    요소.addEventListener("close", onClose);
    return () => {
      요소.removeEventListener("cancel", 취소됨);
      요소.removeEventListener("close", onClose);
    };
  }, [onClose]);

  const 상태 = sendState(기록들, 결과.docId);
  const 주소없음 = 담당자들.filter((칸) => !칸.email?.trim());
  const 메일 = composeMail(결과);
  const 시각글 = (시각: string) => new Date(시각).toLocaleString("ko-KR");

  // [확인하고 발송] 또는 [실패한 주소만 다시 보내기]: 사람이 확인했다는 값(confirmed)과 함께 모의 발송을 요청한다
  async function 보내기(실패만: boolean) {
    // 누르는 순간 저장소의 최신 기록으로 다시 확인한다 (다른 창에서 이미 보냈을 수 있다)
    const 최신 = sendState(loadRecords(), 결과.docId);
    if (!실패만 && 최신.종류 !== "미발송") {
      set오류글("이미 발송한 공문이라 보내지 않았습니다.");
      set단계("오류");
      return;
    }
    if (실패만 && 최신.종류 !== "일부 실패") {
      set오류글("다시 보낼 실패한 주소가 없습니다.");
      set단계("오류");
      return;
    }

    set단계("보내는중");
    try {
      const 응답 = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...결과, confirmed: true, ...(실패만 && 최신.종류 === "일부 실패" ? { recipientIds: 최신.실패한사람 } : {}) }),
      });
      const 본문 = await 응답.json();
      if (!응답.ok) throw new Error(본문?.error?.message ?? "발송 요청이 거절되었습니다.");
      const 받은결과 = 본문.results as 결과칸[];
      set발송결과(받은결과);
      set다시보냄(실패만);
      onSent(결과.docId, 받은결과); // 브라우저에 발송 기록 저장
      set단계("결과");
    } catch (오류) {
      set오류글(오류 instanceof Error && 오류.message ? 오류.message : "발송 요청 중 문제가 생겼습니다.");
      set단계("오류");
    }
  }

  const 개수 = (상태값: SendStatus) => 발송결과.filter((칸) => 칸.status === 상태값).length;
  const 이름 = (id: string) => 담당자들.find((칸) => 칸.id === id);
  const 실패들 = 발송결과.filter((칸) => 칸.status === "실패");
  const 재발송버튼 = (
    <button
      type="button"
      onClick={() => 보내기(true)}
      disabled={단계 === "보내는중"}
      className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
    >
      {단계 === "보내는중" ? "발송 중…" : "실패한 주소만 다시 보내기"}
    </button>
  );

  return (
    <dialog
      ref={창}
      aria-label="공람 발송 확인"
      className="m-auto w-[min(40rem,95vw)] rounded-lg border border-zinc-300 bg-white p-0 text-zinc-900 backdrop:bg-black/50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="max-h-[85vh] space-y-3 overflow-auto p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">공람 발송</h2>
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-900 dark:bg-purple-900 dark:text-purple-100">모의 발송</span>
        </div>

        {단계 === "불러오는중" && <p role="status">받는 사람을 불러오는 중입니다…</p>}
        {단계 === "오류" && <p role="alert" className="text-red-700 dark:text-red-400">{오류글}</p>}

        {(단계 === "확인" || 단계 === "보내는중") && (
          <>
            {상태.종류 === "발송 완료" && (
              <p role="status" className="rounded border border-green-300 bg-green-50 p-2 text-sm font-medium text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100">
                이미 발송한 공문입니다 ({시각글(상태.시각)}). 중복 발송을 막기 위해 다시 보내지 않습니다.
              </p>
            )}
            {상태.종류 === "일부 실패" && (
              <p role="status" className="rounded border border-amber-300 bg-amber-50 p-2 text-sm font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                이미 발송한 공문입니다 ({시각글(상태.시각)}). 실패한 주소 {상태.실패한사람.length}명에게만 다시 보낼 수 있습니다.
              </p>
            )}
            {상태.종류 === "미발송" && (
              <>
                <p className="font-medium" role="status">
                  받는 사람 {담당자들.length}명 (조직도 전체)
                  {주소없음.length > 0 && <span className="text-amber-700 dark:text-amber-400"> · 주소 없음 {주소없음.length}명은 건너뜁니다</span>}
                </p>
                {주소없음.length > 0 && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">주소 없음: {주소없음.map((칸) => `${칸.name}(${칸.department})`).join(", ")}</p>
                )}
              </>
            )}
            {상태.종류 === "일부 실패" && (
              <ul className="list-disc pl-5 text-sm">
                {상태.실패한사람.map((id) => (
                  <li key={id}>{이름(id)?.name ?? id} — {이름(id)?.email ?? "주소 없음"}</li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">보낼 내용 미리보기</p>
              <p className="text-sm">제목: {메일.subject}</p>
              <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 text-sm dark:bg-zinc-800">{메일.body}</pre>
              <p className="mt-1 text-xs text-zinc-500">첨부 원문은 보내지 않습니다.</p>
            </div>
            <p className="text-xs text-zinc-500">이 브라우저에서 보낸 기록만 확인됩니다. 다른 컴퓨터·브라우저에서 보낸 공문은 알 수 없어 중복 발송될 수 있습니다.</p>
          </>
        )}

        {단계 === "결과" && (
          <div className="space-y-2">
            <p className="font-medium" role="status">
              {다시보냄 ? "다시 보내기 결과" : "발송 결과"} (모의): 성공 {개수("성공")}명 · 실패 {개수("실패")}명 · 주소 없음 {개수("주소 없음")}명
            </p>
            {실패들.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-red-700 dark:text-red-400">실패한 주소</p>
                <ul className="list-disc pl-5">
                  {실패들.map((칸) => (
                    <li key={칸.officerId}>{이름(칸.officerId)?.name} — {이름(칸.officerId)?.email}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-zinc-500">실습용 모의 발송이라 실제 메일은 전달되지 않았습니다. 발송 기록은 이 브라우저에 저장되었습니다.</p>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {(단계 === "확인" || 단계 === "보내는중") && 상태.종류 === "미발송" && (
            <button
              type="button"
              onClick={() => 보내기(false)}
              disabled={단계 === "보내는중"}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {단계 === "보내는중" ? "발송 중…" : "확인하고 발송"}
            </button>
          )}
          {(단계 === "확인" || 단계 === "보내는중" || 단계 === "결과") && 상태.종류 === "일부 실패" && 재발송버튼}
          <button
            type="button"
            onClick={() => {
              창.current?.close();
              onClose(); // 창이 닫히면 화면에서도 없애 다음에 다시 열 수 있게 한다
            }}
            disabled={단계 === "보내는중"}
            className="rounded-md border border-zinc-300 px-4 py-2 disabled:opacity-50 dark:border-zinc-600"
          >
            {단계 === "결과" || 단계 === "오류" || 상태.종류 !== "미발송" ? "닫기" : "취소"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

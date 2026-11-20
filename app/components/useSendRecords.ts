"use client";

// 발송 기록을 브라우저(localStorage)에서 읽고 갱신하는 훅 (PLAN.md 작업 15번)
// 기록에는 공문 구분값·받는 사람 id·시각·결과만 들어 있다.
// 저장소는 React 밖의 외부 값이므로 useSyncExternalStore로 읽는다 (다른 탭에서 바뀌어도 따라온다).
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { SendRecord, SendStatus } from "@/types";
import { addResults, loadRecords, saveRecords, 저장키 } from "@/lib/send/history";

const 같은탭알림 = "send-records-changed";

function 구독(알림: () => void) {
  window.addEventListener("storage", 알림); // 다른 탭에서 바뀐 경우
  window.addEventListener(같은탭알림, 알림); // 이 탭에서 저장한 경우
  return () => {
    window.removeEventListener("storage", 알림);
    window.removeEventListener(같은탭알림, 알림);
  };
}

// 저장된 원문 글(바뀌지 않으면 같은 값이라 불필요한 갱신이 없다)
function 원문읽기(): string | null {
  try {
    return localStorage.getItem(저장키);
  } catch {
    return null;
  }
}

export function useSendRecords() {
  const 원문 = useSyncExternalStore(구독, 원문읽기, () => null);
  // 저장소에 저장하지 못한 경우에만 이 창 안에서 임시로 들고 있는다
  const [임시기록, set임시기록] = useState<SendRecord[] | null>(null);
  const [저장실패, set저장실패] = useState(false);

  const 저장된기록 = useMemo(() => loadRecords({ getItem: () => 원문, setItem: () => {} }), [원문]);
  const 기록들 = 임시기록 ?? 저장된기록;

  // 발송이 끝나면 결과를 기록에 합쳐 저장한다. 다른 창에서 저장한 기록이 있을 수 있어 저장소의 최신 기록에 합친다.
  const 기록추가 = useCallback((docId: string, 결과들: { officerId: string; status: SendStatus }[]) => {
    const 다음 = addResults(loadRecords(), docId, 결과들, new Date().toISOString());
    const 저장됨 = saveRecords(다음);
    set저장실패(!저장됨);
    set임시기록(저장됨 ? null : 다음);
    window.dispatchEvent(new Event(같은탭알림));
  }, []);

  return { 기록들, 저장실패, 기록추가 };
}

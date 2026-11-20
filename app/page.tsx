// 메인 화면 (한 화면 앱) — DESIGN.md 3번
// ① 상단 안내 ② 업로드 영역 ③ 공문 목록 · ④ 공문 상세 (Workspace 안에서 서로 연결됨)
// 이 파일은 화면 틀(맨 위 띠·머리·바닥)만 꾸민다. 기능은 Workspace 안에 있으며 바꾸지 않았다.
import Workspace from "./components/Workspace";

export default function Home() {
  return (
    <>
      <div className="gov-strip">
        <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:px-6">
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-amber-300" />
          실습용 화면입니다. 가짜 공문과 가상 조직도(example.com)만 사용합니다.
        </p>
      </div>

      <header className="gov-header">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          {/* 임의로 만든 표지(특정 기관의 상징이 아님) */}
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white"
          >
            법
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">총리실 타부처 법령조회 서비스</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">공문 첨부파일 판정 · 공람 발송 지원</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:p-6">
        <p className="gov-notice rounded-md px-4 py-3 font-medium">
          최종 판단은 담당자가 합니다. 이 화면의 판정은 확인을 돕는 참고 결과입니다.
        </p>

        <Workspace />
      </main>

      <footer className="gov-footer">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="font-medium text-white">총리실 타부처 법령조회 서비스</p>
          <p className="mt-1">실습용 · 가짜 공문과 가상 조직도만 사용 · 공람 발송은 실제로 전달되지 않는 모의 발송입니다.</p>
        </div>
      </footer>
    </>
  );
}

// 메인 화면 (한 화면 앱) — DESIGN.md 3번
// ① 상단 안내 ② 업로드 영역 ③ 공문 목록 · ④ 공문 상세 (Workspace 안에서 서로 연결됨)
// 이 파일은 화면 틀(맨 위 띠·머리줄·큰 제목 영역·바닥)만 꾸민다. 기능은 Workspace 안에 있으며 바꾸지 않았다.
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

      {/* 머리줄: 표지와 서비스 이름만 (메뉴 같은 눌러도 동작하지 않는 요소는 두지 않는다) */}
      <header className="gov-header">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* 임의로 만든 표지(특정 기관의 상징이 아님) */}
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-lg font-bold text-white"
          >
            법
          </span>
          <p className="text-lg font-bold tracking-tight">총리실 타부처 법령조회</p>
        </div>
      </header>

      {/* 큰 제목 영역: 아래쪽이 비스듬히 잘린 남색 면 (누리집 첫 화면의 느낌) */}
      <section className="gov-hero" aria-label="서비스 소개">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-9 sm:px-6 sm:pb-20 sm:pt-12">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">총리실 타부처 법령조회 서비스</h1>
          <p className="mt-2 text-base text-blue-100 sm:text-lg">공문 첨부파일 판정 · 공람 발송 지원</p>
          <p className="gov-hero-notice mt-5 inline-block rounded-full px-5 py-2 text-sm font-semibold sm:text-base">
            최종 판단은 담당자가 합니다. 이 화면의 판정은 확인을 돕는 참고 결과입니다.
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-6 flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:p-6">
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

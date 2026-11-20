// 메인 화면 (한 화면 앱) — DESIGN.md 3번
// ① 상단 안내 ② 업로드 영역 ③ 공문 목록 · ④ 공문 상세 (Workspace 안에서 서로 연결됨)
import Workspace from "./components/Workspace";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <header className="rounded-lg bg-blue-700 p-4 text-white">
        <h1 className="text-xl font-bold sm:text-2xl">총리실 타부처 법령조회 서비스</h1>
        <p className="mt-1 font-medium">최종 판단은 담당자가 합니다. 이 화면의 판정은 확인을 돕는 참고 결과입니다.</p>
        <p className="mt-1 text-sm text-blue-100">실습용입니다. 가짜 공문과 가상 조직도(example.com)만 사용합니다.</p>
      </header>

      <Workspace />
    </main>
  );
}

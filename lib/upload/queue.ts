// 몇 건씩 동시에 처리하는 대기열 (PLAN.md 작업 11번 · DESIGN.md 4.2)
// 항목을 앞에서부터 꺼내 최대 `동시개수`건을 한꺼번에 처리하고, 하나가 끝나면 바로 다음 것을 시작한다.
// 한 건이 실패(예외)해도 다른 건은 계속한다. 파일 내용은 다루지 않는다.

export async function runWithLimit<T>(
  항목들: T[],
  동시개수: number,
  처리: (항목: T) => Promise<void>,
  멈춰야하나: () => boolean = () => false
): Promise<void> {
  let 다음 = 0;
  const 일꾼 = async () => {
    while (다음 < 항목들.length) {
      if (멈춰야하나()) return;
      const 내순서 = 다음++; // 자바스크립트는 한 번에 한 줄씩 실행하므로 순번이 겹치지 않는다
      try {
        await 처리(항목들[내순서]);
      } catch {
        // 한 건의 실패가 나머지를 멈추지 않게 한다. (처리 함수가 스스로 결과를 남긴다)
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(동시개수, 항목들.length) }, 일꾼));
}

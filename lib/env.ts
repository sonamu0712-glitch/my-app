// 비밀 값(.env)을 서버 쪽 코드에서만 읽는 곳 (PLAN.md 작업 2번)
// - 이 파일은 API(서버) 코드에서만 불러 쓴다. 화면(브라우저) 코드에서 부르면 바로 오류를 낸다.
// - 값은 절대 로그·화면·응답에 출력하지 않는다. 이름 앞에 NEXT_PUBLIC_도 붙이지 않는다.

// 브라우저에서 실행되면 비밀 값이 새어 나갈 수 있으므로 막는다.
function 서버에서만확인() {
  if (typeof window !== "undefined") {
    throw new Error("lib/env.ts는 서버 코드에서만 사용할 수 있습니다.");
  }
}

// 비밀 값을 읽는다. 없거나 비어 있으면 값이 아닌 '이름'만 담은 오류를 낸다.
function 비밀값읽기(이름: string): string {
  서버에서만확인();
  const 값 = process.env[이름];
  if (!값) {
    throw new Error(`${이름} 값이 .env에 없습니다.`);
  }
  return 값;
}

// 판정용 AI(OpenAI) 키. 작업 8번(AI 판정)에서 사용한다.
export function getOpenAIKey(): string {
  return 비밀값읽기("OPENAI_API_KEY");
}

// 값이 있는지만 알려준다 (값은 돌려주지 않는다).
export function hasOpenAIKey(): boolean {
  서버에서만확인();
  return Boolean(process.env.OPENAI_API_KEY);
}

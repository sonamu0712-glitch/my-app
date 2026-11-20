// 확장자가 없는 상대 경로 불러오기에 ".ts"를 붙여 다시 찾아 본다.
export async function resolve(지정, 맥락, 다음) {
  try {
    return await 다음(지정, 맥락);
  } catch (오류) {
    if (오류?.code === "ERR_MODULE_NOT_FOUND" && 지정.startsWith(".") && !/\.\w+$/.test(지정)) {
      return 다음(`${지정}.ts`, 맥락);
    }
    throw 오류;
  }
}

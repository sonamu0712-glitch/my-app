// 확인용 스크립트에서 ".ts" 없이 쓴 불러오기("./extract")도 Node가 찾게 해 주는 작은 도우미
// (앱 코드는 그대로 두고, scripts/check-*.mjs 실행할 때만 쓴다)
import { register } from "node:module";
register("./ts-resolve.mjs", import.meta.url);

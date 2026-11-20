// GET /api/org — 가상 조직도 담당자 목록 (DESIGN.md 6번)
// 출력: Officer[] (JSON). 가짜 이름과 example.com 가상 주소만 담겨 있다.
import { getOfficers } from "@/lib/org/load";

export async function GET() {
  try {
    return Response.json(getOfficers());
  } catch {
    return Response.json({ error: { code: "ORG_INVALID", message: "가상 조직도를 불러오지 못했습니다." } }, { status: 500 });
  }
}

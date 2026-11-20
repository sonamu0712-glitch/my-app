// 가상 조직도 불러오기 (PLAN.md 작업 13번 · DESIGN.md 2.2)
// data/org-chart.sample.json 에서 담당자 목록을 읽고, 약속한 모양인지 검사한다.
// 실제 직원 정보는 쓰지 않는다. 주소는 example.com 가상 주소뿐이다.
// 주소 형식 오류·발송 실패용 주소는 시험을 위해 일부러 들어 있으므로 여기서 걸러내지 않는다(발송 때 "실패"로 처리).

import { z } from "zod";
import type { Officer } from "@/types";
import 조직도파일 from "@/data/org-chart.sample.json";

const 담당자모양 = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  email: z.string().nullable(), // 없으면 null
});

const 조직도모양 = z.object({ 담당자: z.array(담당자모양).min(1) });

export function getOfficers(): Officer[] {
  const 결과 = 조직도모양.safeParse(조직도파일);
  if (!결과.success) throw new Error("가상 조직도 파일의 모양이 올바르지 않습니다.");
  const 담당자들 = 결과.data.담당자;
  // id가 겹치면 발송 기록이 섞이므로 막는다
  if (new Set(담당자들.map((칸) => 칸.id)).size !== 담당자들.length) {
    throw new Error("가상 조직도 파일에 같은 id가 있습니다.");
  }
  return 담당자들;
}

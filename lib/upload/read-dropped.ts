// 끌어놓은 폴더 안의 파일을 모두 모은다 (PLAN.md 작업 10번). 브라우저에서만 쓴다.
// 폴더 선택 창으로 고른 경우에는 File.webkitRelativePath를 쓰므로 이 파일이 필요 없다.

import type { 올릴파일 } from "./group";

// 폴더 안 목록은 한 번에 일부만 돌려주므로 빈 결과가 나올 때까지 반복해서 읽는다.
function 목록읽기(읽개: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((성공, 실패) => {
    const 모음: FileSystemEntry[] = [];
    const 읽기 = () =>
      읽개.readEntries((조각) => {
        if (조각.length === 0) return 성공(모음);
        모음.push(...조각);
        읽기();
      }, 실패);
    읽기();
  });
}

async function 훑기(항목: FileSystemEntry, 결과: 올릴파일[]): Promise<void> {
  if (항목.isFile) {
    const 파일 = await new Promise<File>((성공, 실패) => (항목 as FileSystemFileEntry).file(성공, 실패));
    결과.push({ path: 항목.fullPath.replace(/^\//, ""), file: 파일 });
  } else if (항목.isDirectory) {
    const 안쪽 = await 목록읽기((항목 as FileSystemDirectoryEntry).createReader());
    for (const 하위 of 안쪽) await 훑기(하위, 결과);
  }
}

export async function readDroppedItems(항목들: DataTransferItemList): Promise<올릴파일[]> {
  // 비동기 읽기 중에는 목록이 비워지므로 먼저 모두 꺼내 둔다.
  const 입구들 = Array.from(항목들)
    .map((항목) => 항목.webkitGetAsEntry())
    .filter((입구): 입구 is FileSystemEntry => 입구 !== null);
  const 결과: 올릴파일[] = [];
  for (const 입구 of 입구들) await 훑기(입구, 결과);
  return 결과;
}

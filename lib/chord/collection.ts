// 진행 도감 — 설계서 §11
//   연쇄 한 번의 대표 화음 열이 도감의 진행과 같으면 달성(정확히 같은 것을 먼저, 없으면 기능이 같은 것: Ⅴ(가단조)→ⅰ = 정격마침).
//   공통음 도/솔: 한 단계에서 Ⅰ+Ⅳ(Ⅰ+Ⅴ) 덩어리가 도(솔) 타일을 함께 가지고 터짐. 6성부: 크기 6 이상 덩어리가 한 번에.
//   점수(첫 달성 +500, 재달성 +100)는 저장 상태에 달려 있어 엔진이 더한다(resolve 의 totalScore 에는 없음).
import { COLLECTION, SCORE_TABLE, chordOf } from './defs';
import { chordMatches } from './progression';
import type { ChainStep, ChordId } from './types';

export function collectionsFor(steps: ChainStep[], progression: ChordId[]): string[] {
  const ids: string[] = [];
  const seqDefs = COLLECTION.filter((c) => c.progression);
  const exact = seqDefs.filter((c) => c.progression!.length === progression.length && c.progression!.every((id, i) => id === progression[i]));
  const loose = exact.length
    ? []
    : seqDefs.filter((c) => c.progression!.length === progression.length && c.progression!.every((id, i) => chordMatches(progression[i], id)));
  for (const c of [...exact, ...loose]) ids.push(c.id);

  for (const c of COLLECTION) {
    if (c.shared) {
      const [a, b] = c.shared.chords;
      const hit = steps.some((s) =>
        s.events.some((ea) =>
          s.events.some((eb) => {
            if (ea === eb || !chordMatches(ea.chord, a) || !chordMatches(eb.chord, b)) return false;
            const set = new Set(ea.cells.map(([x, y]) => `${x},${y}`));
            // 같은 칸을 함께 가졌고, 그 칸이 공통음(도/솔)인가 — 칸의 음은 두 화음 모두의 구성음이어야 한다
            return eb.cells.some(([x, y]) => set.has(`${x},${y}`) && sharedPitchIs(ea.chord, eb.chord, c.shared!.pitch));
          }),
        ),
      );
      if (hit) ids.push(c.id);
    } else if (c.minSize) {
      if (steps.some((s) => s.events.some((e) => e.size >= c.minSize!))) ids.push(c.id);
    }
  }
  return ids;
}

/** 두 화음의 공통음이 이 음인가(Ⅰ·Ⅳ → 도, Ⅰ·Ⅴ → 솔). 가단조 ⅰ·ⅳ 의 공통음은 라라서 '공통음 도'가 아니다 */
function sharedPitchIs(a: ChordId, b: ChordId, pitch: string): boolean {
  const ta = chordOf(a).tones;
  const tb = chordOf(b).tones;
  return ta.includes(pitch as never) && tb.includes(pitch as never);
}

export function collectionBonus(prevCount: number): number {
  return prevCount > 0 ? SCORE_TABLE.collectionRepeat : SCORE_TABLE.collectionFirst;
}

export function collectionDef(id: string) {
  return COLLECTION.find((c) => c.id === id);
}

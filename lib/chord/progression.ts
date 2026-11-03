// 연쇄와 화음 진행 — 설계서 §8
//   대표 화음 = 가장 큰 덩어리의 화음(같으면 Ⅰ > Ⅴ > Ⅳ)
//   진행 보너스 = 이전 단계의 모든 화음 × 현재 단계의 모든 화음 조합 중 가장 높은 값(표: 부록 A progressionBonus)
//   진행 완성 보너스 = 대표 화음 열의 끝이 Ⅳ→Ⅴ→Ⅰ(+12), Ⅰ→Ⅳ→Ⅴ→Ⅰ(+24, 3단계 보너스와 중복)
// 확장 화음(Ⅴ7·가단조)은 표에 정확한 짝이 없으면 화성 기능(fn)으로 다시 찾는다: Ⅳ→Ⅴ7 = Ⅳ→Ⅴ(+4), Ⅴ(가단조)→ⅰ = Ⅴ→Ⅰ(+8).
import { PROGRESSION_TABLE, SEQUENCE_TABLE, chordOf, type ProgressionEntry } from './defs';
import type { ChordId, PopEvent } from './types';

const BASE: ReadonlySet<ChordId> = new Set<ChordId>(['I', 'IV', 'V']);

/** 대표 화음: 가장 큰 덩어리, 동점이면 rank(Ⅰ > Ⅴ7 > Ⅴ > Ⅳ) */
export function mainChordOf(events: Pick<PopEvent, 'chord' | 'size'>[]): ChordId {
  let best = events[0];
  for (const e of events) {
    if (e.size > best.size || (e.size === best.size && chordOf(e.chord).rank < chordOf(best.chord).rank)) best = e;
  }
  return best.chord;
}

/** 진행 보너스 표에서 짝 찾기: 정확한 짝 → 없으면 기능(fn)끼리 */
export function lookupProgression(from: ChordId, to: ChordId): ProgressionEntry | null {
  const exact = PROGRESSION_TABLE.find((e) => e.from === from && e.to === to);
  if (exact) return exact;
  const ff = chordOf(from).fn;
  const ft = chordOf(to).fn;
  if (ff === from && ft === to) return null;
  return PROGRESSION_TABLE.find((e) => e.from === ff && e.to === ft) ?? null;
}

export interface PairBonus {
  bonus: number;
  name: string | null;
  from: ChordId | null;
  to: ChordId | null;
  text: string | null;
  /** 역진행(Ⅴ→Ⅳ)이 고른 짝이면 한 줄 설명(보너스 0, 벌점 없음) */
  hint: string | null;
}

/** T8: progressionBonus(prev, cur) — 조합 중 가장 높은 값 */
export function progressionBonus(prev: ChordId[], cur: ChordId[]): PairBonus {
  let best: PairBonus = { bonus: 0, name: null, from: null, to: null, text: null, hint: null };
  let reverse: PairBonus | null = null;
  for (const a of prev) {
    for (const b of cur) {
      const e = lookupProgression(a, b);
      if (!e) continue;
      if (e.hint && e.bonus === 0) {
        if (!reverse) reverse = { bonus: 0, name: e.name, from: a, to: b, text: null, hint: reverseHintText(e, a, b) };
        continue;
      }
      if (e.bonus > best.bonus) best = { bonus: e.bonus, name: e.name, from: a, to: b, text: e.text ?? null, hint: null };
    }
  }
  if (best.bonus > 0) return best;
  if (reverse) return reverse;
  // 이름은 있지만 보너스 0 인 짝(현재 표에는 역진행뿐)
  return best;
}

function reverseHintText(e: ProgressionEntry, a: ChordId, b: ChordId): string {
  if (e.from === a && e.to === b) return e.hint!;
  return `${chordOf(a).roman} 다음 ${chordOf(b).roman}는 잘 쓰지 않아요`;
}

/** 실제 화음이 기대한 화음과 같은가. 기대값이 기본 화음(Ⅰ·Ⅳ·Ⅴ)이면 같은 기능의 확장 화음도 인정(Ⅴ7·가단조) */
export function chordMatches(actual: ChordId, expected: ChordId): boolean {
  if (actual === expected) return true;
  return BASE.has(expected) && chordOf(actual).fn === expected;
}

export function seqMatches(actual: ChordId[], expected: ChordId[]): boolean {
  return actual.length === expected.length && actual.every((c, i) => chordMatches(c, expected[i]));
}

/** 대표 화음 열(mains)의 끝이 진행 완성 표와 맞으면 그 보너스들(중복 적용) */
export function sequenceBonus(mains: ChordId[]): { total: number; items: { name: string; bonus: number; sequence: ChordId[] }[] } {
  const items: { name: string; bonus: number; sequence: ChordId[] }[] = [];
  for (const s of SEQUENCE_TABLE) {
    if (mains.length < s.sequence.length) continue;
    if (seqMatches(mains.slice(mains.length - s.sequence.length), s.sequence)) items.push({ name: s.name, bonus: s.bonus, sequence: s.sequence });
  }
  return { total: items.reduce((a, b) => a + b.bonus, 0), items };
}

/** 진행 열 안에 이 진행이 연속으로 들어 있는가 */
export function seqContains(actual: ChordId[], expected: ChordId[]): boolean {
  for (let i = 0; i + expected.length <= actual.length; i++) {
    if (seqMatches(actual.slice(i, i + expected.length), expected)) return true;
  }
  return false;
}

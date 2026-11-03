// 조각 생성 — 설계서 §4.4: 두 타일의 계이름을 스테이지 생성 가중치(부록 B)에 따라 각각 독립적으로 뽑는다.
// pairAffinity(0~1, 기본 0)를 올리면 같은 화음에 속하는 쌍이 더 자주 나온다(밸런싱용).
import { ALL_PITCHES, chordOf } from './defs';
import type { ChordId, Pitch, Rules } from './types';

/** 씨앗이 같으면 같은 수열(테스트·재현용) — mulberry32 */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}

export function drawPitch(weights: Partial<Record<Pitch, number>>, rng: Rng, only?: ReadonlySet<Pitch>): Pitch {
  const items = ALL_PITCHES.filter((p) => (weights[p] ?? 0) > 0 && (!only || only.has(p)));
  if (!items.length) return drawPitch(weights, rng);
  const total = items.reduce((a, p) => a + (weights[p] ?? 0), 0);
  let r = rng.next() * total;
  for (const p of items) {
    r -= weights[p] ?? 0;
    if (r < 0) return p;
  }
  return items[items.length - 1];
}

/** 축과 같은 화음에 드는 음들(활성 화음 기준) */
export function sameChordPitches(axis: Pitch, active: ChordId[]): Set<Pitch> {
  const s = new Set<Pitch>();
  for (const id of active) {
    const tones = chordOf(id).tones;
    if (tones.includes(axis)) tones.forEach((t) => s.add(t));
  }
  return s;
}

/** [축, 위성] */
export function drawPair(rules: Pick<Rules, 'weights' | 'pairAffinity' | 'activeChords'>, rng: Rng): [Pitch, Pitch] {
  const axis = drawPitch(rules.weights, rng);
  if (rules.pairAffinity > 0 && rng.next() < rules.pairAffinity) {
    const same = sameChordPitches(axis, rules.activeChords);
    if (same.size) return [axis, drawPitch(rules.weights, rng, same)];
  }
  return [axis, drawPitch(rules.weights, rng)];
}

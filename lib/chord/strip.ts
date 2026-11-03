// 진행 띠(§8 끝, §13, §14-4) 내용 — 연쇄가 끝나면 대표 화음 열과 마침꼴 이름·보너스를 3초간 보여 준다.
// 진행 완성 보너스(+12·+24)가 있으면 금색 띠. 역진행이 있으면 한 줄 설명(§14-5).
import { chordOf } from './defs';
import type { ChainResult, ChordId } from './types';

export interface StripInfo {
  chords: ChordId[];
  title: string;
  bonus: number | null;
  sub: string | null;
  gold: boolean;
  reverseHint: string | null;
}

export function stripInfo(r: ChainResult): StripInfo {
  const chords = r.progression;
  const reverseHint = r.steps.find((s) => s.reverseHint)?.reverseHint ?? null;
  const seq = r.steps.flatMap((s) => s.sequences.map((q) => ({ ...q, step: s })));
  if (seq.length) {
    const best = seq.reduce((a, b) => (b.bonus >= a.bonus ? b : a));
    return { chords, title: best.name, bonus: best.bonus, sub: best.step.pairText, gold: true, reverseHint };
  }
  const pairs = r.steps.filter((s) => s.pairBonus > 0);
  if (pairs.length) {
    const best = pairs.reduce((a, b) => (b.pairBonus >= a.pairBonus ? b : a));
    return { chords, title: best.progressionName ?? '', bonus: best.pairBonus, sub: best.pairText, gold: false, reverseHint };
  }
  if (reverseHint) return { chords, title: '역진행', bonus: null, sub: '보너스 없음', gold: false, reverseHint };
  if (r.chain === 1) {
    const s = r.steps[0];
    const c = chordOf(s.mainChord);
    return { chords, title: `${c.name}`, bonus: s.simulBonus || null, sub: s.simulLabel ?? c.tones.join('·'), gold: false, reverseHint: null };
  }
  return { chords, title: `${r.chain}연쇄`, bonus: null, sub: null, gold: false, reverseHint: null };
}

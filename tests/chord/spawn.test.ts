// 설계서 §18 T14 생성 가중치, §4.4 pairAffinity, 부록 B 스테이지 데이터
import { describe, expect, it } from 'vitest';
import { ALL_PITCHES, STAGES, goalsOf, stageById, CHORDS, PROGRESSION_TABLE } from '@/lib/chord/defs';
import { Rng, drawPair, drawPitch, sameChordPitches } from '@/lib/chord/spawn';
import type { Pitch } from '@/lib/chord/types';

function sample(stageId: number, n: number, seed = 12345): Record<Pitch, number> {
  const rng = new Rng(seed);
  const counts = Object.fromEntries(ALL_PITCHES.map((p) => [p, 0])) as Record<Pitch, number>;
  const rules = stageById(stageId).rules;
  for (let i = 0; i < n; i++) counts[drawPitch(rules.weights, rng)]++;
  return counts;
}

describe('T14 생성 가중치', () => {
  it('스테이지 3에서 10,000개 뽑으면 계이름마다 14.3% ± 1.0%', () => {
    const c = sample(3, 10000);
    for (const p of ['도', '레', '미', '파', '솔', '라', '시'] as Pitch[]) {
      expect(Math.abs(c[p] / 10000 - 1 / 7)).toBeLessThanOrEqual(0.01);
    }
    expect(c['솔♯']).toBe(0);
  });
  it('스테이지 1에서 도·미·솔 합이 60% ± 1.5%', () => {
    const c = sample(1, 10000);
    expect(Math.abs((c['도'] + c['미'] + c['솔']) / 10000 - 0.6)).toBeLessThanOrEqual(0.015);
  });
  it('여러 씨앗에서도 같은 허용 범위(쌍으로 뽑아도 각 타일은 독립)', () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      const rng = new Rng(seed);
      const rules = stageById(1).rules;
      let ceg = 0;
      for (let i = 0; i < 5000; i++) {
        const [a, b] = drawPair(rules, rng);
        if (['도', '미', '솔'].includes(a)) ceg++;
        if (['도', '미', '솔'].includes(b)) ceg++;
      }
      expect(Math.abs(ceg / 10000 - 0.6)).toBeLessThanOrEqual(0.015);
    }
  });
  it('스테이지별 Ⅰ 비율(§12 표): 1 → 60%, 2 → 50%, 6 → 56%', () => {
    const ratio = (id: number) => {
      const w = stageById(id).rules.weights;
      const total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
      return ((w['도'] ?? 0) + (w['미'] ?? 0) + (w['솔'] ?? 0)) / total;
    };
    expect(ratio(1)).toBeCloseTo(0.6, 3);
    expect(ratio(2)).toBeCloseTo(0.5, 3);
    expect(Math.round(ratio(6) * 100)).toBe(56);
    expect(Math.round(ratio(3) * 100)).toBe(43);
  });
});

describe('pairAffinity (밸런싱용, 기본 0)', () => {
  it('올리면 같은 화음에 드는 쌍이 더 자주 나온다', () => {
    const base = stageById(3).rules;
    const sameRate = (aff: number) => {
      const rng = new Rng(42);
      let same = 0;
      for (let i = 0; i < 4000; i++) {
        const [a, b] = drawPair({ ...base, pairAffinity: aff }, rng);
        if (sameChordPitches(a, base.activeChords).has(b)) same++;
      }
      return same / 4000;
    };
    expect(sameRate(0.8)).toBeGreaterThan(sameRate(0) + 0.2);
  });
});

describe('부록 B 스테이지 데이터(§12 표 10개)', () => {
  it('10개, 시작 레벨·활성 화음·목표·힌트 기본값', () => {
    expect(STAGES.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(STAGES.map((s) => s.startLevel)).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 4, 4]);
    expect(STAGES.map((s) => s.rules.hints)).toEqual([true, true, true, true, true, true, false, false, false, false]);
    expect(STAGES.map((s) => s.rules.intervalLabel)).toEqual([false, false, true, true, true, true, true, true, true, true]);
    expect(stageById(1).rules.activeChords).toEqual(['I']);
    expect(stageById(2).rules.activeChords).toEqual(['I', 'V']);
    expect(stageById(9).rules.activeChords).toEqual(['I', 'IV', 'V7']);
    expect(stageById(10).rules.activeChords).toEqual(['i', 'iv', 'Va']);
    expect(stageById(10).rules.weights['솔♯']).toBe(1);
    expect(goalsOf(stageById(3))).toHaveLength(3); // 세 화음 각 5번
    expect(goalsOf(stageById(2)).map((g) => g.count)).toEqual([10, 20]);
    expect(goalsOf(stageById(8))[0]).toEqual({ type: 'survive', count: 60, chord: undefined, progression: undefined });
    expect(STAGES.filter((s) => s.rules.garbage.enabled).map((s) => s.id)).toEqual([8, 9, 10]); // §6.3 "스테이지 8부터"
    for (const s of STAGES) expect(s.card.image).toBe(`chord-stage${s.id}.svg`);
  });
  it('부록 A 화음·진행 표', () => {
    expect(CHORDS.I.tones).toEqual(['도', '미', '솔']);
    expect(CHORDS.IV.tones).toEqual(['파', '라', '도']);
    expect(CHORDS.V.tones).toEqual(['솔', '시', '레']);
    expect(CHORDS.V7.tones).toEqual(['솔', '시', '레', '파']);
    expect(CHORDS.Va.tones).toEqual(['미', '솔♯', '시']);
    expect(PROGRESSION_TABLE).toHaveLength(7);
  });
});

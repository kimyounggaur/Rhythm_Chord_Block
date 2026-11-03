// 설계서 §18 테스트 케이스 (마디 판정·표기) — 표의 모든 열을 그대로 검사한다.
import { describe, expect, it } from 'vitest';
import { analyzeRow } from '@/lib/rhythm/measure';
import { getMeter } from '@/lib/rhythm/meters';
import { notationText } from '@/lib/rhythm/notation';
import type { MeterId, Rules } from '@/lib/rhythm/types';
import { row, RULES_ALL, RULES_STRICT, RULES_TIES } from './helpers';

interface Case {
  n: string;
  meter: MeterId;
  row: string;
  runs: number[];
  pitches: string; // 길이+계이름, 예 "h도 q.미 e시"
  sync: number;
  chord: 'I' | 'IV' | 'V' | null;
  pattern: string | null;
  notation: string;
  strict?: string;
  rules?: Rules;
}

const ABBR: Record<number, string> = { 1: 'e', 2: 'q', 3: 'q.', 4: 'h', 6: 'h.', 8: 'w' };

const CASES: Case[] = [
  // 4/4 (세기 [3,0,1,0,2,0,1,0], 표기 묶음 [4,4])
  { n: '1', meter: '4/4', row: 'I1 I1 I1 I1 T1 T1 T1 L1', runs: [4, 3, 1], pitches: 'h도 q.미 e시', sync: 0, chord: null, pattern: null, notation: 'h q. e' },
  { n: '2', meter: '4/4', row: 'O1 O1 O2 O2 O3 O3 O4 O4', runs: [2, 2, 2, 2], pitches: 'q레 q레 q레 q레', sync: 0, chord: null, pattern: 'q4', notation: 'q q q q' },
  {
    n: '3', meter: '4/4', row: 'J1 S1 S1 Z1 Z1 T1 T1 L1', runs: [1, 2, 2, 2, 1], pitches: 'e라 q파 q솔 q미 e시',
    sync: 3, chord: null, pattern: 'sync-basic', notation: 'e q q q e', strict: 'e q e_e q e',
  },
  {
    n: '4', meter: '4/4', row: 'T1 T1 I1 I1 I1 I1 O1 O1', runs: [2, 4, 2], pitches: 'q미 h도 q레',
    sync: 1, chord: null, pattern: 'sync-qhq', notation: 'q h q', strict: 'q q_q q',
  },
  { n: '5', meter: '4/4', row: 'I1 I1 I1 I1 T1 T1 Z1 Z1', runs: [4, 2, 2], pitches: 'h도 q미 q솔', sync: 0, chord: 'I', pattern: 'h-q-q', notation: 'h q q' },
  {
    n: '6', meter: '4/4', row: 'L1 L1 L1 O1 O1 Z1 Z1 L2', runs: [3, 2, 2, 1], pitches: 'q.시 q레 q솔 e시',
    sync: 2, chord: 'V', pattern: null, notation: 'q. q q e', strict: 'q. e_e q e',
  },
  { n: '7', meter: '4/4', row: 'I1 I1 I1 I1 I2 I2 I2 I2', runs: [4, 4], pitches: 'h도 h도', sync: 0, chord: null, pattern: 'h2', notation: 'h h' },
  {
    n: '7b', meter: '4/4', row: 'I1 I1 I1 I1 I2 I2 I2 I2', runs: [8], pitches: 'w도', sync: 0, chord: null, pattern: 'whole', notation: 'w',
    rules: RULES_TIES,
  },
  {
    n: '8', meter: '4/4', row: 'I1 L1 J1 T1 I2 L2 J2 S1', runs: [1, 1, 1, 1, 1, 1, 1, 1], pitches: 'e도 e시 e라 e미 e도 e시 e라 e파',
    sync: 0, chord: null, pattern: 'e8', notation: 'e e e e e e e e',
  },
  { n: '9', meter: '4/4', row: 'L1 L1 L1 J1 T1 T1 T1 Z1', runs: [3, 1, 3, 1], pitches: 'q.시 e라 q.미 e솔', sync: 0, chord: null, pattern: 'dot', notation: 'q. e q. e' },
  { n: '10', meter: '4/4', row: 'Z1 Z1 J1 J1 J1 S1 S1 L1', runs: [2, 3, 2, 1], pitches: 'q솔 q.라 q파 e시', sync: 2, chord: null, pattern: null, notation: 'q q_e q e' },
  // 6/8 (세기 [3,0,0,2,0,0], 표기 묶음 [3,3])
  { n: '13', meter: '6/8', row: 'L1 L1 L1 J1 J1 J1', runs: [3, 3], pitches: 'q.시 q.라', sync: 0, chord: null, pattern: 'c2', notation: 'q. q.' },
  { n: '14', meter: '6/8', row: 'O1 O1 S1 S1 O2 O2', runs: [2, 2, 2], pitches: 'q레 q파 q레', sync: 1, chord: null, pattern: 'hemiola', notation: 'q e_e q' },
  // 3/4 (세기 [3,0,1,0,1,0], 표기 묶음 [6])
  { n: '15', meter: '3/4', row: 'I1 I1 I1 I1 O1 O1', runs: [4, 2], pitches: 'h도 q레', sync: 0, chord: null, pattern: 'h-q', notation: 'h q' },
  { n: '16', meter: '3/4', row: 'L1 L1 L1 Z1 Z1 J1', runs: [3, 2, 1], pitches: 'q.시 q솔 e라', sync: 1, chord: null, pattern: null, notation: 'q. q e' },
];

describe('§18 마디 판정 케이스', () => {
  for (const c of CASES) {
    it(`케이스 ${c.n} (${c.meter}) ${c.row}`, () => {
      const meter = getMeter(c.meter);
      const r = analyzeRow(row(c.row), meter, c.rules ?? RULES_ALL);
      expect(r.complete).toBe(true);
      expect(r.meterId).toBe(c.meter);
      expect(r.notes.map((n) => n.length)).toEqual(c.runs);
      expect(r.notes.map((n) => `${ABBR[n.length]}${n.pitch}`).join(' ')).toBe(c.pitches);
      expect(r.syncopationCount).toBe(c.sync);
      expect(r.notes.filter((n) => n.syncopated).length).toBe(c.sync);
      expect(r.chord).toBe(c.chord);
      expect(r.patternId).toBe(c.pattern);
      expect(notationText(r.notation)).toBe(c.notation);
      if (c.strict) {
        const s = analyzeRow(row(c.row), meter, { ...(c.rules ?? RULES_ALL), strictNotation: true });
        expect(notationText(s.notation)).toBe(c.strict);
      } else {
        // 엄격 모드에서도 같아야 하는 경우(예외 c·d 와 무관)
        const s = analyzeRow(row(c.row), meter, { ...(c.rules ?? RULES_ALL), strictNotation: true });
        expect(notationText(s.notation)).toBe(c.notation);
      }
    });
  }

  it('케이스 3: 당김음이 된 음은 q파·q솔·q미 (셋 다 뒷박에서 시작)', () => {
    const r = analyzeRow(row('J1 S1 S1 Z1 Z1 T1 T1 L1'), getMeter('4/4'), RULES_ALL);
    expect(r.notes.map((n) => n.syncopated)).toEqual([false, true, true, true, false]);
  });

  it('케이스 14: 가운데 q 만 당김음(시작 2, 칸 3의 세기 2)', () => {
    const r = analyzeRow(row('O1 O1 S1 S1 O2 O2'), getMeter('6/8'), RULES_ALL);
    expect(r.notes.map((n) => n.syncopated)).toEqual([false, true, false]);
  });

  it('케이스 16: q솔(시작 3, 칸 4의 세기 1)이 당김음, [3,1,2] 패턴과 다르다', () => {
    const r = analyzeRow(row('L1 L1 L1 Z1 Z1 J1'), getMeter('3/4'), RULES_ALL);
    expect(r.notes.map((n) => n.syncopated)).toEqual([false, true, false]);
    expect(r.patternId).toBeNull();
  });

  it('케이스 11: 미완성 줄은 판정하지 않는다', () => {
    const r = analyzeRow(row('I1 I1 I1 I1 _ _ T1 T1'), getMeter('4/4'), RULES_ALL);
    expect(r.complete).toBe(false);
    expect(r.notes).toEqual([]);
    expect(r.score).toBe(0);
  });

  it('케이스 7b: 붙임줄 ON — 합친 음은 tied, 두 개체를 모두 기억', () => {
    const r = analyzeRow(row('I1 I1 I1 I1 I2 I2 I2 I2'), getMeter('4/4'), RULES_TIES);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toMatchObject({ pitch: '도', start: 0, length: 8, tied: true });
    expect(r.notes[0].pieceIds).toHaveLength(2);
  });

  it('케이스 7b 패턴 whole 은 붙임줄이 꺼져 있으면 나오지 않는다(케이스 7 = h2)', () => {
    const r = analyzeRow(row('I1 I1 I1 I1 I2 I2 I2 I2'), getMeter('4/4'), RULES_ALL);
    expect(r.patternId).toBe('h2');
  });

  it('같은 종류라도 다른 개체면 다른 음 (§3)', () => {
    const r = analyzeRow(row('O1 O1 O2 O2 O3 O3 O4 O4'), getMeter('4/4'), RULES_ALL);
    expect(r.notes).toHaveLength(4);
    expect(r.notes.map((n) => n.pieceIds[0])).toEqual([2001, 2002, 2003, 2004]);
  });

  it('화음 마디: 계이름이 하나뿐이면 보너스 없음, chordBonus 꺼지면 판정 안 함', () => {
    const m = getMeter('4/4');
    expect(analyzeRow(row('I1 I1 I1 I1 T1 T1 Z1 Z1'), m, { ...RULES_ALL, chordBonus: false }).chord).toBeNull();
    expect(analyzeRow(row('I1 I1 I1 I1 I2 I2 I2 I2'), m, RULES_ALL).chord).toBeNull();
    // 도+파 → Ⅳ, 레+솔 → Ⅴ
    expect(analyzeRow(row('I1 I1 I1 I1 S1 S1 S2 S2'), m, RULES_ALL).chord).toBe('IV');
    expect(analyzeRow(row('O1 O1 O2 O2 Z1 Z1 Z2 Z2'), m, RULES_ALL).chord).toBe('V');
  });
});

describe('§18 점수 검증 (레벨 1)', () => {
  const m = getMeter('4/4');

  it('케이스 3 = 100 + 150(당김음 3개) + 500(sync-basic 첫 달성) = 750', () => {
    const r = analyzeRow(row('J1 S1 S1 Z1 Z1 T1 T1 L1'), m, RULES_ALL, { level: 1 });
    expect(r.score).toBe(750);
    expect(r.breakdown.map((b) => [b.label, b.points])).toEqual([
      ['마디 완성', 100],
      ['당김음 ×3', 150],
      ['새 패턴 당김음 기본형', 500],
    ]);
  });

  it('케이스 5 = 100 + 200(Ⅰ 화음) = 300 — 패턴 항목은 도감 상태에 따라 따로 붙는다', () => {
    // 설계서 §18 의 '케이스 5 = 300' 은 패턴(h-q-q) 보너스를 넣지 않은 합. 도감을 닫은 규칙(patternBonus:false)에서 정확히 300.
    const closed = analyzeRow(row('I1 I1 I1 I1 T1 T1 Z1 Z1'), m, { ...RULES_ALL, patternBonus: false }, { level: 1 });
    expect(closed.score).toBe(300);
    expect(closed.breakdown.map((b) => [b.label, b.points])).toEqual([
      ['마디 완성', 100],
      ['Ⅰ 화음 마디', 200],
    ]);
    // 도감이 열려 있으면 §10·§11 대로 패턴 첫 달성 +500, 재달성 +100
    const first = analyzeRow(row('I1 I1 I1 I1 T1 T1 Z1 Z1'), m, RULES_ALL, { level: 1 });
    expect(first.score).toBe(300 + 500);
    const again = analyzeRow(row('I1 I1 I1 I1 T1 T1 Z1 Z1'), m, RULES_ALL, { level: 1, isCollected: () => true });
    expect(again.score).toBe(300 + 100);
  });

  it('레벨 배수: 마디·당김음·화음은 × 레벨, 패턴은 그대로', () => {
    const r = analyzeRow(row('J1 S1 S1 Z1 Z1 T1 T1 L1'), m, RULES_ALL, { level: 3 });
    expect(r.score).toBe(300 + 450 + 500);
  });

  it('당김음 보너스가 꺼진 스테이지에서는 당김음 점수가 없다(판정은 한다)', () => {
    const r = analyzeRow(row('J1 S1 S1 Z1 Z1 T1 T1 L1'), m, { ...RULES_ALL, syncopationBonus: false });
    expect(r.syncopationCount).toBe(3);
    expect(r.breakdown.some((b) => b.kind === 'sync')).toBe(false);
  });

  it('붙임줄 음표당 +30', () => {
    const r = analyzeRow(row('I1 I1 I1 I1 I2 I2 I2 I2'), m, RULES_TIES, { level: 1 });
    expect(r.breakdown.find((b) => b.kind === 'tie')?.points).toBe(30);
    expect(r.score).toBe(100 + 500 + 30); // 마디 + 새 패턴 whole + 붙임줄
  });
});

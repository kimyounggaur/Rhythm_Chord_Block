// 설계서 §8 표기 규칙 — 8.6 예시 표, 예외 (a)~(d), 엄격 모드, 기 묶음(§8.3, VexFlow generateBeams)
import { describe, expect, it } from 'vitest';
import * as VFCore from 'vexflow/core';
import { analyzeRow } from '@/lib/rhythm/measure';
import { getMeter } from '@/lib/rhythm/meters';
import { cutPoints, durationsForLength, noteToNotation, notationText, rhythmCaption } from '@/lib/rhythm/notation';
import type { MeterId } from '@/lib/rhythm/types';
import { buildMeasure, beamIndexGroups, type VF } from '@/components/rhythm/score/vexBuild';
import { row, RULES_ALL, RULES_TIES } from './helpers';

const vf = VFCore as unknown as VF;

function note(meterId: MeterId, start: number, length: number, strict = false): string {
  return notationText(noteToNotation({ pitch: '도', start, length, syncopated: false }, getMeter(meterId), strict));
}

describe('§8.1 길이 → 음표', () => {
  it('1=e 2=q 3=q. 4=h 5=h_e 6=h. 7=h._e 8=w', () => {
    const t = (n: number) => durationsForLength(n).join('_');
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(t)).toEqual(['8', 'q', 'qd', 'h', 'h_8', 'hd', 'hd_8', 'w']);
  });
});

describe('§8.6 예시 표 (4/4, 표기 묶음 [4,4])', () => {
  const rows: [number, number, string, string][] = [
    [0, 4, 'h', 'h'],
    [1, 3, 'q.', 'q.'], // 뒷박 시작이지만 묶음 안
    [2, 4, 'h', 'q_q'], // 예외 d
    [3, 2, 'q', 'e_e'], // 예외 c
    [3, 4, 'e_q.', 'e_q.'],
    [2, 3, 'q_e', 'q_e'],
  ];
  for (const [s, len, def, strict] of rows) {
    it(`칸 ${s}~${s + len - 1} 길이 ${len}: 기본 ${def} / 엄격 ${strict}`, () => {
      expect(note('4/4', s, len)).toBe(def);
      expect(note('4/4', s, len, true)).toBe(strict);
    });
  }
  it('6/8 칸 2~3 길이 2: e_e (기본·엄격 같음)', () => {
    expect(note('6/8', 2, 2)).toBe('e_e');
    expect(note('6/8', 2, 2, true)).toBe('e_e');
  });
});

describe('§8.2 예외 (a)(b)', () => {
  it('(b) 마디 전체를 덮으면 자르지 않는다: 4/4 w, 6/8 h. (붙임줄)', () => {
    expect(note('4/4', 0, 8)).toBe('w');
    expect(note('6/8', 0, 6)).toBe('h.');
    expect(note('3/4', 0, 6)).toBe('h.');
  });
  it('(a) 묶음을 통째로 덮으면 자르지 않는다: 9/8 칸 0~5 = h., 12/8 칸 3~8 = h.', () => {
    expect(note('9/8', 0, 6)).toBe('h.');
    expect(note('12/8', 3, 6)).toBe('h.');
    expect(cutPoints(3, 6, getMeter('12/8'), true)).toEqual([]);
  });
  it('예외 c·d 는 4/4 만: 5/4 [6,4] 에서 칸 5~6 은 자른다', () => {
    expect(note('5/4', 5, 2)).toBe('e_e');
    expect(note('7/8', 3, 2)).toBe('e_e');
  });
  it('묶음 경계를 둘 넘는 음: 12/8 칸 2~7 → e_q._q', () => {
    expect(note('12/8', 2, 6)).toBe('e_q._q');
  });
  it('길이 5·7 (붙임줄 규칙): 3/4 칸 0~4 = h_e, 4/4 칸 0~6 = h_q.', () => {
    expect(note('3/4', 0, 5)).toBe('h_e');
    expect(note('4/4', 0, 7)).toBe('h_q.');
  });
});

describe('표기 음표의 시작 칸·붙임줄·당김음 표시', () => {
  it('케이스 10 의 q_e: 시작 2·4, 앞 음표만 tieToNext', () => {
    const r = analyzeRow(row('Z1 Z1 J1 J1 J1 S1 S1 L1'), getMeter('4/4'), RULES_ALL);
    expect(r.notation.map((n) => [n.start, n.duration, n.tieToNext])).toEqual([
      [0, 'q', false],
      [2, 'q', true],
      [4, '8', false],
      [5, 'q', false],
      [7, '8', false],
    ]);
    // 당김음 음(칸 2 q.라, 칸 5 q파)의 표기 조각은 모두 syncopated
    expect(r.notation.map((n) => n.syncopated)).toEqual([false, true, true, true, false]);
  });
  it('엄격 모드 전환이 결과를 바꾼다(케이스 3)', () => {
    const m = getMeter('4/4');
    const a = analyzeRow(row('J1 S1 S1 Z1 Z1 T1 T1 L1'), m, RULES_ALL);
    const b = analyzeRow(row('J1 S1 S1 Z1 Z1 T1 T1 L1'), m, { ...RULES_ALL, strictNotation: true });
    expect(notationText(a.notation)).not.toBe(notationText(b.notation));
  });
});

describe('§8.3 기 묶음 (VexFlow Beam.generateBeams)', () => {
  function beams(meterId: MeterId, spec: string, ties = false) {
    const r = analyzeRow(row(spec), getMeter(meterId), ties ? RULES_TIES : RULES_ALL);
    return beamIndexGroups(buildMeasure(vf, r.notation, getMeter(meterId)));
  }
  it('케이스 8: 4/4 e×8 → 기 2개씩 4묶음', () => {
    expect(beams('4/4', 'I1 L1 J1 T1 I2 L2 J2 S1')).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
    ]);
  });
  it('6/8 e×6 → 3개씩 2묶음', () => {
    expect(beams('6/8', 'I1 L1 J1 T1 I2 L2')).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });
  it('9/8 e×9 → 3개씩 3묶음', () => {
    expect(beams('9/8', 'I1 L1 J1 T1 I2 L2 J2 S1 I3').map((g) => g.length)).toEqual([3, 3, 3]);
  });
  it('12/8 e×12 → 3개씩 4묶음', () => {
    expect(beams('12/8', 'I1 L1 J1 T1 I2 L2 J2 S1 I3 L3 J3 T3').map((g) => g.length)).toEqual([3, 3, 3, 3]);
  });
  it('7/8 e×7 → 2+2+3', () => {
    expect(beams('7/8', 'I1 L1 J1 T1 I2 L2 J2').map((g) => g.length)).toEqual([2, 2, 3]);
  });
  it('케이스 3 e q q q e: 8분음표가 박 묶음에 혼자라 기 없음', () => {
    expect(beams('4/4', 'J1 S1 S1 Z1 Z1 T1 T1 L1')).toEqual([]);
  });
  it('말달리기 q e e q e e: 같은 박 안의 e e 만 묶는다', () => {
    expect(beams('4/4', 'O1 O1 L1 J1 O2 O2 T1 S1')).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });
  it('붙임줄(StaveTie)이 표기의 tieToNext 수만큼 생긴다(케이스 14 q e_e q)', () => {
    const r = analyzeRow(row('O1 O1 S1 S1 O2 O2'), getMeter('6/8'), RULES_ALL);
    const b = buildMeasure(vf, r.notation, getMeter('6/8'));
    expect(b.ties).toHaveLength(1);
    expect(b.notes).toHaveLength(4);
  });
});

describe('캡션', () => {
  it('"2분 · 점4분 · 8분", 같은 길이는 ×n', () => {
    expect(rhythmCaption([{ length: 4 }, { length: 3 }, { length: 1 }])).toBe('2분 · 점4분 · 8분');
    expect(rhythmCaption([{ length: 2 }, { length: 2 }, { length: 2 }, { length: 2 }])).toBe('4분×4');
    expect(rhythmCaption([{ length: 8 }])).toBe('온음표');
  });
});

describe('박자표 표기(오선 앞의 숫자)', () => {
  it('박자표 이름 그대로: 6/8·9/8·12/8·7/8 은 박 수가 아니라 8분음표 수', async () => {
    const { timeSigOf, timeSigParts } = await import('@/components/rhythm/score/vexBuild');
    expect(['4/4', '3/4', '6/8', '9/8', '12/8', '5/4', '7/8'].map((id) => timeSigOf(getMeter(id as MeterId)))).toEqual(['4/4', '3/4', '6/8', '9/8', '12/8', '5/4', '7/8']);
    expect(timeSigParts(getMeter('12/8'))).toEqual({ num: 12, den: 8 });
  });
});

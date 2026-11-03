// 설계서 §18 T6·T7(연쇄 점수), T8(진행 보너스 함수), §10 점수표, §11 도감
import { describe, expect, it } from 'vitest';
import { buildTimeline, resolve, TIMING } from '@/lib/chord/chain';
import { progressionBonus, sequenceBonus, mainChordOf } from '@/lib/chord/progression';
import { chainPowerOf, groupBonusOf } from '@/lib/chord/score';
import { boardToGrid } from '@/lib/chord/grid';
import { grid, RULES } from './helpers';

describe('T6 2연쇄 정격마침', () => {
  // 설계서의 T6 격자를 그대로 두면 §7 규칙상 1단계에서 Ⅰ{C,C,E,G}(윗줄 C·E·G 와 맨 위 C)가 이미 이어져 있어
  // Ⅰ·Ⅴ 가 함께 터진다(아래 '설계서 격자 그대로' 참고). 그래서 설명한 단계(Ⅴ 먼저 → 낙하 → Ⅰ)가 그대로 나오도록
  // 타일 배치만 고친 격자로 검사한다: 1단계 Ⅴ {G,B,D,D} → 40, 2단계 낙하 뒤 Ⅰ {C,C,E,G} → 연쇄 6 + Ⅴ→Ⅰ 8 = 14 → 560.
  const b = grid('C . . . . . .', 'C D . . . . .', 'B D . . . . .', 'G E G . . . .');
  const r = resolve(b, RULES);
  it('1단계 Ⅴ {G,B,D,D} → 40', () => {
    expect(r.steps[0].events.map((e) => e.chord)).toEqual(['V']);
    expect(r.steps[0].events[0].size).toBe(4);
    expect(r.steps[0].score).toBe(40);
  });
  it('2단계 Ⅰ {C,C,E,G} → 연쇄 6 + Ⅴ→Ⅰ 8 = 14 → 560', () => {
    const s = r.steps[1];
    expect(s.events.map((e) => e.chord)).toEqual(['I']);
    expect(s.chainPower).toBe(6);
    expect(s.pairBonus).toBe(8);
    expect(s.progressionName).toBe('정격마침');
    expect(s.score).toBe(560);
  });
  it('합계 600, 진행 [V, I], 도감 auth', () => {
    expect(r.chain).toBe(2);
    expect(r.totalScore).toBe(600);
    expect(r.progression).toEqual(['V', 'I']);
    expect(r.collectionId).toBe('auth');
  });
  it('설계서 격자 그대로: 1단계에서 Ⅰ(5)·Ⅴ(5)가 솔 2개를 함께 가지고 동시에 터진다(규칙 확인용)', () => {
    const literal = resolve(grid('C . . . . . .', 'C E G . . . .', 'G B D D . . .'), RULES);
    expect(literal.chain).toBe(1);
    expect(literal.steps[0].events.map((e) => `${e.chord}${e.size}`).sort()).toEqual(['I5', 'V5']);
    expect(literal.steps[0].sharedCount).toBe(2);
    // 10 × 8 × (성부 2+2 + 공통음 6) = 800, 대표 화음은 동점이라 Ⅰ, 도감 shared-g
    expect(literal.totalScore).toBe(800);
    expect(literal.collectionIds).toEqual(['shared-g']);
  });
});

describe('T7 3연쇄 마침 진행 Ⅳ→Ⅴ→Ⅰ', () => {
  const b = grid(
    'G . . . . . .',
    'E . . . . . .',
    'C . . . . . .',
    'D . . . . . .',
    'B . . . . . .',
    'G C . . . . .',
    'C X . . . . .',
    'A D . . . . .',
    'F A . . . . .',
  );
  const r = resolve(b, RULES);
  it('1단계: Ⅳ {F,A,C,A} 4개 → 40, X 는 터진 C 에 맞닿아 함께 제거', () => {
    const s = r.steps[0];
    expect(s.events.map((e) => e.chord)).toEqual(['IV']);
    expect(s.score).toBe(40);
    expect(s.removedCount).toBe(5);
  });
  it('2단계: 열 0 이 G·B·D·C·E·G, 열 1 이 D·C 로 내려와 Ⅴ {G,D,B,D} → 6 + Ⅳ→Ⅴ 4 = 10 → 400', () => {
    const fall = r.frames.filter((f) => f.kind === 'fall')[0];
    const g = boardToGrid(fall.board);
    expect(g.slice(8)).toEqual(['G......', 'E......', 'C......', 'D......', 'BC.....', 'GD.....']);
    expect(r.steps[1].events.map((e) => e.chord)).toEqual(['V']);
    expect(r.steps[1].chainPower + r.steps[1].pairBonus).toBe(10);
    expect(r.steps[1].score).toBe(400);
  });
  it('3단계: Ⅰ {C,C,E,G} → 14 + Ⅴ→Ⅰ 8 + 마침 진행 12 = 34 → 1360', () => {
    const s = r.steps[2];
    expect(s.chainPower).toBe(14);
    expect(s.pairBonus).toBe(8);
    expect(s.sequences.map((q) => [q.name, q.bonus])).toEqual([['마침 진행', 12]]);
    expect(s.progressionBonus).toBe(20);
    expect(s.score).toBe(1360);
  });
  it('합계 1800, 진행 [IV, V, I], 도감 cad3', () => {
    expect(r.chain).toBe(3);
    expect(r.totalScore).toBe(1800);
    expect(r.progression).toEqual(['IV', 'V', 'I']);
    expect(r.collectionId).toBe('cad3');
    expect(r.collectionIds).toEqual(['cad3']);
    expect(r.allClear).toBe(true); // +2000 은 게임이 따로 더한다(합계 1800 에는 없음)
  });
  it('연출 순서: 터짐 450ms, 연쇄 한 단계 600~700ms', () => {
    const tl = buildTimeline(r.frames);
    expect(tl.popAt).toHaveLength(3);
    for (let i = 1; i < tl.popAt.length; i++) {
      const gap = tl.popAt[i] - tl.popAt[i - 1];
      expect(gap).toBeGreaterThanOrEqual(600);
      expect(gap).toBeLessThanOrEqual(700);
    }
    for (const p of tl.phases) {
      if (p.kind === 'pop') expect(p.end - p.start).toBe(TIMING.pop);
      else expect(p.fallMs).toBeLessThanOrEqual(240);
    }
  });
});

describe('T8 진행 보너스 함수', () => {
  it.each([
    [['V'], ['I'], 8],
    [['IV'], ['I'], 6],
    [['IV'], ['V'], 4],
    [['I'], ['V'], 3],
    [['I'], ['IV'], 2],
    [['V'], ['IV'], 0],
    [['I'], ['I'], 0],
    [['I', 'V'], ['I'], 8],
  ] as const)('%j → %j = %i', (prev, cur, want) => {
    expect(progressionBonus([...prev], [...cur]).bonus).toBe(want);
  });
  it('역진행 Ⅴ→Ⅳ 는 보너스 0 + 한 줄 힌트', () => {
    const p = progressionBonus(['V'], ['IV']);
    expect(p.name).toBe('역진행');
    expect(p.hint).toBe('Ⅴ 다음 Ⅳ는 잘 쓰지 않아요');
  });
  it('완성 보너스: [IV,V,I] 3단계째 +12, [I,IV,V,I] 4단계째 +24(+12 중복)', () => {
    expect(sequenceBonus(['IV', 'V', 'I']).total).toBe(12);
    expect(sequenceBonus(['I', 'IV', 'V', 'I']).total).toBe(36);
    expect(sequenceBonus(['I', 'IV', 'V', 'I']).items.map((i) => i.name)).toEqual(['마침 진행', '기본 진행']);
    expect(sequenceBonus(['IV', 'V']).total).toBe(0);
  });
  it('확장: Ⅴ7→Ⅰ +10, Ⅳ→Ⅴ7 은 Ⅳ→Ⅴ 로(+4), 가단조 Ⅴ→ⅰ 은 정격마침(+8)', () => {
    expect(progressionBonus(['V7'], ['I']).bonus).toBe(10);
    expect(progressionBonus(['IV'], ['V7']).bonus).toBe(4);
    expect(progressionBonus(['Va'], ['i'])).toMatchObject({ bonus: 8, name: '정격마침' });
    expect(progressionBonus(['Va'], ['iv']).hint).toBe('Ⅴ 다음 ⅳ는 잘 쓰지 않아요');
  });
  it('대표 화음 = 가장 큰 덩어리, 같으면 Ⅰ > Ⅴ > Ⅳ', () => {
    expect(mainChordOf([{ chord: 'IV', size: 5 }, { chord: 'I', size: 4 }])).toBe('IV');
    expect(mainChordOf([{ chord: 'IV', size: 4 }, { chord: 'V', size: 4 }])).toBe('V');
    expect(mainChordOf([{ chord: 'V', size: 4 }, { chord: 'I', size: 4 }])).toBe('I');
  });
});

describe('§10 점수표', () => {
  it('연쇄(chainPower) 0,6,14,28,50,80,110,140,170,200 이후 +30', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(chainPowerOf)).toEqual([0, 6, 14, 28, 50, 80, 110, 140, 170, 200, 230, 260]);
  });
  it('성부 4→0, 5→2, 6→3, 7→4, 8→5, 9→6, 10→7, 11+→10', () => {
    expect([4, 5, 6, 7, 8, 9, 10, 11, 15].map(groupBonusOf)).toEqual([0, 2, 3, 4, 5, 6, 7, 10, 10]);
  });
  it('동시 화음: 서로 다른 화음 2개(공유 없음) +3', () => {
    // Ⅰ {C,E,G,C}(왼쪽)와 Ⅴ {B,D,B,D}(오른쪽, 솔 없이는 안 되므로 솔 하나 포함) — 서로 닿지 않게
    const b = grid('C E . . G B .', 'C G . . D D .');
    const r = resolve(b, RULES);
    expect(r.steps[0].events).toHaveLength(2);
    expect(r.steps[0].simulBonus).toBe(3);
    expect(r.steps[0].score).toBe(10 * 8 * 3);
  });
  it('세 화음 동시 +8 (방해 타일은 점수에 안 든다)', () => {
    const b = grid('. . . . . . D', '. . . . . . D', 'C E X F A X B', 'C G X C F X G');
    const r = resolve(b, RULES);
    expect(r.steps[0].events.map((e) => e.chord).sort()).toEqual(['I', 'IV', 'V']);
    expect(r.steps[0].simulBonus).toBe(8);
    expect(r.steps[0].poppedCount).toBe(12);
    expect(r.steps[0].score).toBe(10 * 12 * 8);
    expect(r.allClear).toBe(true);
  });
  it('성부 보너스는 이벤트마다: Ⅰ 6성부(+3) → 10×6×3 = 180, 도감 sextet', () => {
    const r = resolve(grid('C E G . . . .', 'C E G . . . .'), RULES);
    expect(r.steps[0].groupBonus).toBe(3);
    expect(r.totalScore).toBe(180);
    expect(r.collectionIds).toEqual(['sextet']);
  });
});

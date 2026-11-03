// 설계서 §18 T1~T5, T12, T13 — 터짐 판정 엔진(§7)과 부족한 음 힌트(§14-1)
import { describe, expect, it } from 'vitest';
import { resolve } from '@/lib/chord/chain';
import { findPops } from '@/lib/chord/pops';
import { findHints, haloMap } from '@/lib/chord/hints';
import { grid, cellSet, RULES, MAJOR } from './helpers';

describe('T1 기본 터짐', () => {
  const b = grid('C E . . . . .', 'C G . . . . .');
  it('Ⅰ 덩어리 {C,E,C,G} 크기 4 → 터짐, 터진 수 4', () => {
    const r = findPops(b, MAJOR, RULES);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].chord).toBe('I');
    expect(r.events[0].size).toBe(4);
    expect(r.poppedCount).toBe(4);
    expect(cellSet(r.removedCells)).toEqual(['0,13', '0,14', '1,13', '1,14']);
  });
  it('점수 10×4×max(1,0) = 40', () => {
    const res = resolve(b, RULES);
    expect(res.chain).toBe(1);
    expect(res.totalScore).toBe(40);
    expect(res.steps[0].score).toBe(40);
  });
});

describe('T2 구성음 부족', () => {
  const b = grid('C E . . . . .', 'C E . . . . .');
  it('크기 4지만 솔 없음 → 안 터짐', () => {
    expect(findPops(b, MAJOR, RULES).events).toHaveLength(0);
  });
  it('힌트 "솔"', () => {
    const h = findHints(b, MAJOR);
    expect(h).toHaveLength(1);
    expect(h[0].chord).toBe('I');
    expect(h[0].missing).toBe('솔');
  });
});

describe('T3 크기 부족', () => {
  // C E 위에 G 하나(ㄱ자)
  const b = grid('G . . . . . .', 'C E . . . . .');
  it('구성음 모두, 크기 3 → 안 터짐, 힌트 "+1"', () => {
    expect(findPops(b, MAJOR, RULES).events).toHaveLength(0);
    const h = findHints(b, MAJOR);
    expect(h).toHaveLength(1);
    expect(h[0].missing).toBeNull();
    expect(h[0].size).toBe(3);
  });
});

describe('T4 공통음 동시 화음', () => {
  const b = grid('. . C . . . .', 'F A C E G . .');
  it('Ⅳ {F,A,C,C}·Ⅰ {C,C,E,G} 둘 다 터지고 C 2개 공유, 제거 6', () => {
    const r = findPops(b, MAJOR, RULES);
    const byChord = Object.fromEntries(r.events.map((e) => [e.chord, e]));
    expect(Object.keys(byChord).sort()).toEqual(['I', 'IV']);
    expect(byChord.IV.size).toBe(4);
    expect(byChord.I.size).toBe(4);
    expect(r.sharedCount).toBe(2);
    expect(cellSet(r.sharedCells)).toEqual(['2,13', '2,14']);
    expect(r.poppedCount).toBe(6);
    expect(r.removedCells).toHaveLength(6);
  });
  it('동시 보너스(공통음) +6 → 10×6×6 = 360, 도감 shared-c', () => {
    const res = resolve(b, RULES);
    expect(res.chain).toBe(1);
    expect(res.steps[0].simulBonus).toBe(6);
    expect(res.totalScore).toBe(360);
    expect(res.collectionIds).toContain('shared-c');
    expect(res.collectionId).toBe('shared-c');
  });
});

describe('T5 비화음 인접 제거', () => {
  const b = grid('C E X . X . .', 'C G . . . . .');
  it('E 와 맞닿은 첫 X 만 제거, 둘째 X 는 남음, 점수는 4개 기준 40', () => {
    const r = findPops(b, MAJOR, RULES);
    expect(r.poppedCount).toBe(4);
    expect(cellSet(r.junkCells)).toEqual(['2,13']);
    const res = resolve(b, RULES);
    expect(res.totalScore).toBe(40);
    expect(res.board[14][4]?.kind).toBe('garbage'); // 둘째 X 는 바닥으로 내려와 남는다
    expect(res.board.flat().filter(Boolean)).toHaveLength(1);
  });
  it('비활성 화음 타일(스테이지 1의 레·파·라·시)도 맞닿으면 함께 사라지고 점수에는 안 든다', () => {
    const b1 = grid('C E D . A . .', 'C G . . . . .');
    const r = findPops(b1, ['I'], RULES);
    expect(r.poppedCount).toBe(4);
    expect(cellSet(r.junkCells)).toEqual(['2,13']);
    expect(resolve(b1, { activeChords: ['I'], minGroup: 4 }).totalScore).toBe(40);
  });
  it('숨김 줄(y=0)의 타일은 판정하지 않는다', () => {
    const rows = ['C E . . . . .', 'C G . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .',
      '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .'];
    // 15줄 = 첫 줄이 숨김 줄(y=0), 둘째 줄이 y=1 — 숨김 줄의 C E 는 덩어리에 들어가지 않는다
    const b2 = grid(...rows);
    expect(findPops(b2, MAJOR, RULES).events).toHaveLength(0);
  });
});

describe('T12 힌트', () => {
  const cases: [string[], string | null | undefined][] = [
    [['C . . . . . .', 'C E . . . . .'], '솔'], // {C,C,E} → 솔
    [['C E G . . . .'], '+1'], // {C,E,G} → +1
    [['C E . . . . .', 'C E . . . . .'], '솔'], // {C,C,E,E} → 솔
    [['C C . . . . .', 'C C . . . . .'], undefined], // {C,C,C,C} → 없음
    [['F A . . . . .'], undefined], // {F,A} → 없음(크기 2)
    [['G B . . . . .'], undefined], // {G,B} → 없음
  ];
  it.each(cases)('%j → %s', (rows, want) => {
    const h = findHints(grid(...rows), MAJOR);
    if (want === undefined) expect(h).toHaveLength(0);
    else {
      expect(h).toHaveLength(1);
      expect(h[0].missing ?? '+1').toBe(want);
    }
  });
  it('한 번에 최대 3개, 큰 덩어리 먼저, 배지는 덩어리 맨 위 타일', () => {
    // 후보 4개: Ⅰ{C,C,E,E}·Ⅳ{A,F,F,A}·Ⅴ{B,D,B,B}(크기 4) + Ⅴ{B,B,D}(크기 3) → 크기 4 셋만
    const b = grid(
      'C . . . . . .',
      'C . . F . . B',
      'E E . A . D B',
      'X X X X X X X',
      'A F . G . B D',
      'F A . B . B B',
    );
    expect(findPops(b, MAJOR, RULES).events).toHaveLength(0);
    const h = findHints(b, MAJOR);
    expect(h).toHaveLength(3);
    expect(h.map((x) => x.size)).toEqual([4, 4, 4]);
    expect(h.map((x) => `${x.chord}:${x.missing}`)).toEqual(['I:솔', 'IV:도', 'V:솔']);
    expect(h[0].anchor).toEqual([0, 9]); // 덩어리 맨 위 타일
  });
});

describe('T13 Ⅴ7 (확장)', () => {
  const V7 = ['I', 'IV', 'V7'] as const;
  const rules = { activeChords: [...V7], minGroup: 4 };
  it('{G,B,D,F} → Ⅴ7 로 터짐', () => {
    const r = findPops(grid('G B D F . . .'), [...V7], rules);
    expect(r.events.map((e) => e.chord)).toEqual(['V7']);
  });
  it('{G,B,D,D} → Ⅴ 로 터짐', () => {
    const r = findPops(grid('G B D D . . .'), [...V7], rules);
    expect(r.events.map((e) => e.chord)).toEqual(['V']);
  });
  it('{G,B,F,F} → 안 터짐(레 없음)', () => {
    expect(findPops(grid('G B F F . . .'), [...V7], rules).events).toHaveLength(0);
    // 힌트는 터지는 데 필요한 '레'
    const h = findHints(grid('G B F F . . .'), [...V7]);
    expect(h.find((x) => x.chord === 'V7')?.missing).toBe('레');
  });
  it('Ⅴ7→Ⅰ 진행 +10 (정격마침(7)), 도감 auth7', () => {
    // 1단계: Ⅴ7 {G,D,B,F} 4개 → 40. 2단계: G·E 와 E 가 내려와 C 옆에 Ⅰ {G,E,E,C} → 연쇄 6 + Ⅴ7→Ⅰ 10 = 16 → 640
    const b = grid('G . . . . . .', 'E E . . . . .', 'G D . . . . .', 'B F C . . . .');
    const r = resolve(b, rules);
    expect(r.chain).toBe(2);
    expect(r.progression).toEqual(['V7', 'I']);
    expect(r.steps[1].pairBonus).toBe(10);
    expect(r.steps[1].progressionName).toBe('정격마침(7)');
    expect(r.totalScore).toBe(40 + 640);
    expect(r.collectionIds).toEqual(['auth7']);
  });
  it('받침대: 솔은 Ⅰ·Ⅴ7 반반, 파는 Ⅳ·Ⅴ7 반반', () => {
    const b = grid('C . . . . . .', 'E G B . . . .', '. . F A . . .');
    // 줄이 공중에 떠도 받침대 계산에는 상관없다
    const m = haloMap(b, [...V7]);
    expect(m.get('1,13')).toBe('i-v7');
    expect(m.get('2,14')).toBe('iv-v7');
  });
});

describe('받침대(덩어리 테두리) — 에셋 README haloNames 와 같은 결과', () => {
  it('크기 2 이상만, 공통음은 두 덩어리 모두 크기 2 이상일 때 반반', () => {
    const b = grid('. . C . . . .', 'F A C E G . .');
    const m = haloMap(b, MAJOR);
    expect(m.get('0,14')).toBe('iv');
    expect(m.get('2,14')).toBe('i-iv');
    expect(m.get('2,13')).toBe('i-iv');
    expect(m.get('4,14')).toBe('i'); // G 는 Ⅴ 덩어리가 크기 1이라 Ⅰ 만
  });
  it('스테이지 1(Ⅰ만 켜짐)에서 잠든 타일은 받침대가 없다', () => {
    const m = haloMap(grid('D F . . . . .', 'C E . . . . .'), ['I']);
    expect(m.get('0,13')).toBeUndefined();
    expect(m.get('0,14')).toBe('i');
  });
});

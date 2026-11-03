// §6.3 비화음 타일(방해) 공급 규칙, T5 와 이어서 엔진에서의 동작
import { describe, expect, it } from 'vitest';
import { COLS, emptyBoard } from '@/lib/chord/board';
import { stageById } from '@/lib/chord/defs';
import { ChordEngine } from '@/lib/chord/engine';
import { dropGarbage, garbageCount } from '@/lib/chord/garbage';
import { Rng } from '@/lib/chord/spawn';

describe('방해 타일 개수: 2 + floor(레벨/3), 최대 6', () => {
  it.each([
    [1, 2],
    [2, 2],
    [3, 3],
    [5, 3],
    [6, 4],
    [9, 5],
    [12, 6],
    [30, 6],
  ])('레벨 %i → %i개', (lv, n) => {
    expect(garbageCount(lv, { base: 2, max: 6 })).toBe(n);
  });
});

describe('서로 다른 열 위에서 떨어진다', () => {
  it('n개면 n개의 서로 다른 열, 각 열의 맨 위에 쌓인다', () => {
    for (let seed = 1; seed < 60; seed++) {
      const b = emptyBoard();
      b[14][2] = { id: 1, kind: 'note', pitch: '도' };
      const n = 1 + (seed % 6);
      const d = dropGarbage(b, n, new Rng(seed), 100);
      expect(d.placed).toHaveLength(n);
      expect(new Set(d.placed.map((p) => p.x)).size).toBe(n);
      for (const p of d.placed) expect(p.y).toBe(p.x === 2 ? 13 : 14);
    }
  });
  it('숨김 줄까지 꽉 찬 열에 떨어지는 타일은 버린다', () => {
    const b = emptyBoard();
    for (let y = 0; y < 15; y++) for (let x = 0; x < COLS; x++) b[y][x] = { id: y * 7 + x + 1, kind: 'note', pitch: '레' };
    const d = dropGarbage(b, 6, new Rng(1), 1000);
    expect(d.placed).toHaveLength(0);
    expect(d.discarded).toBe(6);
  });
});

describe('엔진: 스테이지 8부터 12초마다, 조작 중이면 착지한 뒤에', () => {
  it('12초가 지나도 조각을 조작하는 동안에는 떨어지지 않고, 착지 뒤 등장 전에 떨어진다', () => {
    const e = new ChordEngine({ mode: 'campaign', stage: stageById(8), seed: 21 });
    e.start();
    const garbageOnBoard = () => e.board.flat().filter((x) => x?.kind === 'garbage').length;
    let t = 0;
    while (e.pendingGarbage === 0 && t < 13000) {
      e.update(20);
      t += 20;
    }
    expect(t).toBeGreaterThanOrEqual(12000);
    expect(t).toBeLessThan(12100);
    // 12초가 되어 쌓였지만 아직 보드에는 없다(조각이 착지하고 등장하기 전까지 기다린다)
    expect(e.pendingGarbage).toBe(garbageCount(3, { base: 2, max: 6 }));
    expect(garbageOnBoard()).toBe(0);
    expect(['falling', 'splitting', 'resolving']).toContain(e.phase);
    for (let i = 0; i < 600 && garbageOnBoard() === 0; i++) {
      if (e.phase === 'falling') e.hardDrop();
      e.update(16);
      if (e.phase === 'falling') expect(garbageOnBoard() === 0 || e.pendingGarbage === 0).toBe(true);
    }
    expect(garbageOnBoard()).toBe(3);
    expect(e.pendingGarbage).toBe(0);
    const xs = e.board.flatMap((row) => row.map((tile, x) => (tile?.kind === 'garbage' ? x : -1))).filter((x) => x >= 0);
    expect(new Set(xs).size).toBe(xs.length); // 서로 다른 열
  });
  it('스테이지 1~7 에는 방해가 없다', () => {
    const e = new ChordEngine({ mode: 'campaign', stage: stageById(7), seed: 2 });
    e.start();
    for (let i = 0; i < 400; i++) e.update(50);
    expect(e.pendingGarbage).toBe(0);
  });
});

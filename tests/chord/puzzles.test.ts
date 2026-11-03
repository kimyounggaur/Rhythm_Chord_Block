// 부록 C 연쇄 퍼즐 — 손으로 만든 퍼즐 5개가 정말 풀리는지 엔진으로 확인한다(§17 M10)
import { describe, expect, it } from 'vitest';
import { PUZZLES, stageById } from '@/lib/chord/defs';
import { ChordEngine } from '@/lib/chord/engine';
import { parseGrid } from '@/lib/chord/grid';
import { solvePuzzle } from '@/lib/chord/puzzles';
import { resolve } from '@/lib/chord/chain';

describe('연쇄 퍼즐 5개', () => {
  it('5개, 형식(보이는 14줄 × 7칸)', () => {
    expect(PUZZLES).toHaveLength(5);
    for (const p of PUZZLES) {
      expect(p.board).toHaveLength(14);
      for (const row of p.board) expect(row).toMatch(/^[A-GX.#]{7}$/);
      expect(p.pairs.length).toBeGreaterThan(0);
    }
  });

  it.each(PUZZLES.map((p) => [p.id, p] as const))('%s: 판이 정착돼 있고, 시작부터 터지지 않고, 풀린다', (_id, p) => {
    const check = solvePuzzle(p);
    expect(check.settled).toBe(true);
    expect(check.popsAtStart).toBe(false);
    expect(check.solutions.length).toBeGreaterThan(0);
    // 아무렇게나 놓아서는 잘 안 풀린다(놓는 자리 26가지 중 몇 개만 정답)
    expect(check.solutions.length).toBeLessThanOrEqual(6);
  });

  it('퍼즐 모드 엔진: 첫 풀이대로 조작하면 성공(puzzleSolved)', () => {
    for (const p of PUZZLES) {
      const sol = solvePuzzle(p).solutions[0];
      const e = new ChordEngine({ mode: 'puzzle', stage: stageById(3), puzzle: p, seed: 1 });
      e.start();
      sol.forEach((at) => {
        while (e.pair!.dir !== at.dir) e.rotate(true);
        while (e.pair!.x !== at.x) e.move(at.x > e.pair!.x ? 1 : -1);
        e.hardDrop();
        for (let i = 0; i < 400 && e.phase !== 'falling' && e.phase !== 'stageClear' && e.phase !== 'gameover'; i++) e.update(16);
      });
      for (let i = 0; i < 600 && e.phase !== 'stageClear' && e.phase !== 'gameover'; i++) e.update(16);
      expect(e.phase, p.id).toBe('stageClear');
      const ev = e.drainEvents();
      expect(ev.some((x) => x.type === 'puzzleSolved')).toBe(true);
    }
  });

  it('퍼즐 모드: 조각을 다 쓰고도 목표를 못 채우면 실패(gameover: puzzleFail), 저절로 떨어지지 않는다', () => {
    const p = PUZZLES[0];
    const e = new ChordEngine({ mode: 'puzzle', stage: stageById(3), puzzle: p, seed: 1 });
    e.start();
    const y0 = e.pair!.y;
    e.update(5000);
    expect(e.pair!.y).toBe(y0);
    e.move(1);
    e.move(1);
    e.move(1); // 오른쪽 끝 — 아무것도 안 터진다
    e.hardDrop();
    for (let i = 0; i < 100; i++) e.update(16);
    expect(e.phase).toBe('gameover');
    expect(e.drainEvents().some((x) => x.type === 'gameOver' && x.reason === 'puzzleFail')).toBe(true);
  });

  it('부록 C 예시 판(그대로)은 §7 규칙상 시작부터 Ⅰ{C,C,E,G}가 터져 쓸 수 없다 → p01 은 같은 생각(솔을 시 왼쪽에)으로 다시 만든 판', () => {
    const appendixC = ['.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......', 'C......', 'CEG....', '.BDD...'];
    const r = resolve(parseGrid(appendixC).board, { activeChords: ['I', 'IV', 'V'], minGroup: 4 });
    expect(r.chain).toBeGreaterThan(0);
    expect(PUZZLES[0].hint).toBe('솔을 시 왼쪽에 놓으면 아래가 먼저 터져요.');
  });
});

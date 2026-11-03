// 설계서 §18 T9(회전 킥), T10(분리 낙하), T11(게임 오버), §5.3 180° 뒤집기, §5.1 하드 드롭 300ms, §6.2 속도표
import { describe, expect, it } from 'vitest';
import { emptyBoard } from '@/lib/chord/board';
import { stageById } from '@/lib/chord/defs';
import { ChordEngine, dropIntervalFor } from '@/lib/chord/engine';
import { parseGrid } from '@/lib/chord/grid';
import { dropDistance, lockPair, satellitePos, tryFlip, tryRotate } from '@/lib/chord/pair';
import type { ActivePair, Pitch } from '@/lib/chord/types';

const P = (x: number, y: number, dir: 0 | 1 | 2 | 3, axis: Pitch = '도', sat: Pitch = '미'): ActivePair => ({
  axis,
  satellite: sat,
  x,
  y,
  dir,
  axisId: 901,
  satId: 902,
});

describe('T9 회전 킥', () => {
  it('축 (6,5) 위성 위(0), 시계 회전 → 위성이 (7,5)로 갈 수 없음 → 축 (5,5), 위성 (6,5)', () => {
    const r = tryRotate(emptyBoard(), P(6, 5, 0), true)!;
    expect([r.x, r.y, r.dir]).toEqual([5, 5, 1]);
    expect(satellitePos(r)).toEqual([6, 5]);
  });
  it('축 아래가 타일이고 위성을 아래(2)로 돌리면 축이 (x,4)로 올라감', () => {
    const b = emptyBoard();
    b[6][3] = { id: 1, kind: 'note', pitch: '레' };
    const r = tryRotate(b, P(3, 5, 1), true)!; // 오른쪽(1) → 아래(2)
    expect([r.x, r.y, r.dir]).toEqual([3, 4, 2]);
    expect(satellitePos(r)).toEqual([3, 5]);
  });
  it('왼쪽 벽에서 위성을 왼쪽(3)으로 → 축이 오른쪽으로 1칸', () => {
    const r = tryRotate(emptyBoard(), P(0, 5, 0), false)!;
    expect([r.x, r.y, r.dir]).toEqual([1, 5, 3]);
  });
  it('양쪽이 막힌 1칸 폭 틈에서는 회전 실패, 뒤집기(180°)는 된다', () => {
    const { board } = parseGrid(['X . X . . . .', 'X . X . . . .', 'X . X . . . .']);
    const p = P(1, 13, 0); // 위성 (1,12)
    expect(tryRotate(board, p, true)).toBeNull();
    expect(tryRotate(board, p, false)).toBeNull();
    const f = tryFlip(board, p)!;
    expect(f.dir).toBe(2);
    expect([f.x, f.y]).toEqual([1, 13]);
    expect(satellitePos(f)).toEqual([1, 14]);
  });
});

describe('§5.3 엔진: 회전을 300ms 안에 두 번 → 180° 뒤집기', () => {
  function engineInGap() {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(3), seed: 7 });
    e.start();
    // 가운데 열 양옆을 막는다(1칸 폭 틈)
    const rows = Array.from({ length: 14 }, () => '. . X . X . .');
    e.debugLoadGrid(rows);
    return e;
  }
  it('두 번째 누름이 300ms 안이면 뒤집힌다', () => {
    const e = engineInGap();
    const before = { ...e.pair! };
    expect(e.rotate(true)).toBe(false);
    e.update(120);
    expect(e.rotate(true)).toBe(true);
    expect(e.pair!.dir).toBe(2);
    expect(e.pair!.axis).toBe(before.axis);
  });
  it('300ms 가 지나면 다시 처음부터', () => {
    const e = engineInGap();
    expect(e.rotate(true)).toBe(false);
    e.update(350);
    expect(e.rotate(false)).toBe(false);
    expect(e.pair!.dir).toBe(0);
  });
});

describe('T10 분리 낙하', () => {
  it('가로 쌍이 열 2(높이 3)·열 3(높이 0) 위에 떨어지면 열 2 타일은 y=11, 열 3 타일은 y=14', () => {
    const { board } = parseGrid(['. . X . . . .', '. . X . . . .', '. . X . . . .']);
    const p = P(2, 1, 1); // 축 (2,1), 위성 (3,1)
    const d = dropDistance(board, p);
    const res = lockPair(board, { ...p, y: p.y + d });
    expect(res.landed.find((t) => t.id === 901)).toMatchObject({ x: 2, y: 11 });
    expect(res.landed.find((t) => t.id === 902)).toMatchObject({ x: 3, y: 14 });
    expect(res.maxSplit).toBe(3);
  });
  it('엔진에서도: 하드 드롭 → 분리 낙하(splitting) → 둘 다 착지', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(3), seed: 3 });
    e.start();
    e.debugLoadGrid(['. . X . . . .', '. . X . . . .', '. . X . . . .']);
    e.debugSetPair('레', '시');
    e.rotate(true); // 위성 오른쪽
    e.move(-1); // 축 x=2, 위성 x=3
    expect([e.pair!.x, e.pair!.dir]).toEqual([2, 1]);
    e.hardDrop();
    expect(e.phase).toBe('splitting');
    e.update(500);
    expect(e.board[11][2]?.pitch).toBe('레');
    expect(e.board[14][3]?.pitch).toBe('시');
    expect(e.phase).toBe('falling');
  });
});

describe('T11 게임 오버', () => {
  it('착지 뒤 (3,1)에 타일이 있으면 다음 등장 시 gameover', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(3), seed: 11 });
    e.start();
    // 가운데 열을 y=3 까지 채운다 → 새 조각이 (3,2)·(3,1)에 놓이면 (3,1)이 찬다
    const rows = Array.from({ length: 14 }, (_, i) => (i < 2 ? '. . . . . . .' : (i % 2 ? '. . . A . . .' : '. . . B . . .')));
    e.debugLoadGrid(rows);
    e.debugSetPair('레', '라');
    expect(e.phase).toBe('falling');
    e.hardDrop();
    e.update(16);
    expect(e.board[1][3]).not.toBeNull();
    expect(e.phase).toBe('gameover');
    expect(e.drainEvents().some((ev) => ev.type === 'gameOver')).toBe(true);
  });
});

describe('§5.1 하드 드롭 뒤 300ms 동안 하드 드롭 무시', () => {
  it('곧바로 다시 누르면 무시, 300ms 뒤에는 된다', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(1), seed: 5 });
    e.start();
    e.debugSetPair('레', '라'); // 스테이지 1에서 안 터지는 잠든 음
    expect(e.hardDrop()).toBe(true);
    e.update(1);
    expect(e.phase).toBe('falling');
    expect(e.hardDrop()).toBe(false);
    e.update(300);
    expect(e.hardDrop()).toBe(true);
  });
  it('하드 드롭은 칸당 +2, 소프트 드롭은 칸당 +1', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(1), seed: 5 });
    e.start();
    e.debugSetPair('레', '라');
    e.hardDrop(); // 축 y=1 → y=14: 13칸
    expect(e.score).toBe(26);
    e.update(400);
    e.debugSetPair('파', '시');
    const y0 = e.pair!.y;
    e.setSoftDrop(true);
    for (let i = 0; i < 4; i++) e.update(50); // 1000/20 = 50ms 마다 1칸
    const moved = e.pair!.y - y0;
    expect(moved).toBeGreaterThanOrEqual(4);
    expect(e.score).toBe(26 + moved);
  });
});

describe('§6.2 속도표', () => {
  it('레벨 1~10: 1000·850·720·600·500·420·350·300·250·200, 11+ −15/레벨 최소 80', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(dropIntervalFor)).toEqual([1000, 850, 720, 600, 500, 420, 350, 300, 250, 200]);
    expect(dropIntervalFor(11)).toBe(185);
    expect(dropIntervalFor(18)).toBe(80);
    expect(dropIntervalFor(30)).toBe(80);
  });
  it('조각 25개마다 레벨 업', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(1), seed: 9 });
    e.start();
    let placed = 0;
    while (placed < 25 && e.phase !== 'gameover') {
      if (e.phase === 'falling') {
        e.debugLoadGrid([]); // 빈 보드로(게임 오버 없이 개수만 센다)
        e.debugSetPair('레', '라');
        e.hardDrop();
        placed++;
      }
      e.update(400);
    }
    expect(e.pieces).toBe(25);
    expect(e.level).toBe(2);
  });
});

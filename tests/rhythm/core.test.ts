// M1 코어: SRS 회전·월킥, 7-bag, 속도표(§6.2), 연주 큐(§9)의 순수 로직
import { describe, expect, it } from 'vitest';
import { createBoard, fits, dropDistance } from '@/lib/rhythm/board';
import { drawFromBag, newBag, seededRng } from '@/lib/rhythm/bag';
import { getMeter, METERS } from '@/lib/rhythm/meters';
import { BoundedQueue, nextBoundaryTick, startCells } from '@/lib/rhythm/playback';
import { dropIntervalMs, levelFor, speedForLevel } from '@/lib/rhythm/speed';
import { kickTests, pieceCells, SHAPES, spawnX } from '@/lib/rhythm/srs';
import { PIECE_TYPES, type ActivePiece, type PieceType, type Rotation } from '@/lib/rhythm/types';

describe('SRS 회전 상태', () => {
  it('조각마다 칸 4개, 상태 4개', () => {
    for (const t of PIECE_TYPES) {
      expect(SHAPES[t]).toHaveLength(4);
      for (const s of SHAPES[t]) expect(s).toHaveLength(4);
    }
  });
  it('T 시계 회전: 위 → 오른쪽 → 아래 → 왼쪽', () => {
    const key = (r: Rotation) => SHAPES.T[r].map(([x, y]) => `${x}${y}`).join(' ');
    expect(key(0)).toBe('10 01 11 21');
    expect(key(1)).toBe('10 11 21 12');
    expect(key(2)).toBe('01 11 21 12');
    expect(key(3)).toBe('10 01 11 12');
  });
  it('I 는 4×4 상자에서 2열(R)·2행(2)·1열(L)로 돈다', () => {
    expect(SHAPES.I[1].every(([x]) => x === 2)).toBe(true);
    expect(SHAPES.I[2].every(([, y]) => y === 2)).toBe(true);
    expect(SHAPES.I[3].every(([x]) => x === 1)).toBe(true);
  });
  it('O 는 돌려도 모양이 같다', () => {
    for (const r of [1, 2, 3] as Rotation[]) expect(SHAPES.O[r]).toEqual(SHAPES.O[0]);
  });
  it('공개된 월킥 표: JLSTZ 0→R 는 (0,0)(−1,0)(−1,+1)(0,−2)(−1,−2) — 보드 좌표에서는 y 부호가 반대', () => {
    expect(kickTests('T', 0, 1)).toEqual([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]);
    expect(kickTests('I', 0, 1)).toEqual([[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]]);
    expect(kickTests('O', 0, 1)).toEqual([[0, 0]]);
  });
  it('등장 위치: 가로 중앙, y=0~1', () => {
    for (const m of METERS) {
      for (const t of PIECE_TYPES) {
        const cells = pieceCells(t, 0, spawnX(t, m.width), 0);
        const xs = cells.map(([x]) => x);
        const left = Math.min(...xs);
        const right = m.width - 1 - Math.max(...xs);
        expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
        expect(cells.every(([, y]) => y >= 0 && y <= 1)).toBe(true);
      }
    }
  });
});

describe('월킥: 벽에 붙은 상태에서도 회전된다 (M1 완료 기준 2)', () => {
  function rotateWithKicks(board: ReturnType<typeof createBoard>, p: ActivePiece, dir: 1 | -1): ActivePiece | null {
    const to = (((p.rotation + dir) % 4) + 4) % 4 as Rotation;
    for (const [dx, dy] of kickTests(p.type, p.rotation, to)) {
      const np = { ...p, rotation: to, x: p.x + dx, y: p.y + dy };
      if (fits(board, np)) return np;
    }
    return null;
  }
  for (const width of [6, 8, 12]) {
    for (const t of PIECE_TYPES) {
      for (const wall of ['left', 'right'] as const) {
        it(`${width}칸 보드, ${t} 세운 모양을 ${wall === 'left' ? '왼쪽' : '오른쪽'} 벽에 붙여 양쪽으로 회전`, () => {
          const board = createBoard(width);
          for (const r of [1, 3] as Rotation[]) {
            const cells = SHAPES[t][r];
            const minX = Math.min(...cells.map(([x]) => x));
            const maxX = Math.max(...cells.map(([x]) => x));
            const x = wall === 'left' ? -minX : width - 1 - maxX;
            const p: ActivePiece = { id: 1, type: t, rotation: r, x, y: 8 };
            expect(fits(board, p)).toBe(true);
            for (const dir of [1, -1] as const) {
              const np = rotateWithKicks(board, p, dir);
              expect(np, `${t} r${r} dir${dir}`).not.toBeNull();
            }
          }
        });
      }
    }
  }
  it('I 세로를 왼쪽 벽에서 시계 회전하면 오른쪽으로 2칸 밀려 들어간다(표의 세 번째 시험)', () => {
    const board = createBoard(8);
    const p: ActivePiece = { id: 1, type: 'I', rotation: 1, x: -2, y: 8 };
    expect(fits(board, p)).toBe(true);
    const to = 2 as Rotation;
    const tests = kickTests('I', 1, to);
    const idx = tests.findIndex(([dx, dy]) => fits(board, { ...p, rotation: to, x: p.x + dx, y: p.y + dy }));
    expect(idx).toBe(2);
    expect(p.x + tests[idx][0]).toBe(0);
  });
  it('고스트(떨어질 자리) = 바닥까지의 거리', () => {
    const board = createBoard(8);
    const p: ActivePiece = { id: 1, type: 'O', rotation: 0, x: 2, y: 0 };
    expect(dropDistance(board, p)).toBe(16);
    board[17][3] = { pieceId: 9, type: 'I' };
    expect(dropDistance(board, p)).toBe(15);
  });
});

describe('7-bag', () => {
  it('7개씩 끊으면 묶음마다 7종이 한 번씩', () => {
    const rng = seededRng(42);
    const bag: PieceType[] = [];
    const seq = Array.from({ length: 7 * 500 }, () => drawFromBag(bag, rng));
    for (let i = 0; i < seq.length; i += 7) {
      expect(new Set(seq.slice(i, i + 7)).size).toBe(7);
    }
  });
  it('같은 조각 사이 간격은 최대 12 (오래 안 나오는 일이 없다)', () => {
    const rng = seededRng(7);
    const bag: PieceType[] = [];
    const seq = Array.from({ length: 7000 }, () => drawFromBag(bag, rng));
    for (const t of PIECE_TYPES) {
      let last = -1;
      let maxGap = 0;
      seq.forEach((p, i) => {
        if (p === t) {
          if (last >= 0) maxGap = Math.max(maxGap, i - last - 1);
          last = i;
        }
      });
      expect(maxGap).toBeLessThanOrEqual(12);
    }
  });
  it('여러 번 섞으면 순서가 고르게 나온다(첫 조각이 7종 모두)', () => {
    const rng = seededRng(1);
    const firsts = new Map<PieceType, number>();
    for (let i = 0; i < 7000; i++) {
      const b = newBag(rng);
      firsts.set(b[0], (firsts.get(b[0]) ?? 0) + 1);
    }
    for (const t of PIECE_TYPES) expect(firsts.get(t)! / 7000).toBeGreaterThan(0.12);
  });
});

describe('§6.2 속도표', () => {
  it('레벨 1~10 간격(ms)과 BPM', () => {
    const ms = Array.from({ length: 10 }, (_, i) => speedForLevel(i + 1).intervalMs);
    expect(ms).toEqual([1200, 1000, 600, 500, 429, 300, 250, 214, 150, 125]);
    const bpm = Array.from({ length: 10 }, (_, i) => speedForLevel(i + 1).bpm);
    expect(bpm).toEqual([100, 120, 100, 120, 140, 100, 120, 140, 100, 120]);
    const unit = Array.from({ length: 10 }, (_, i) => speedForLevel(i + 1).unit).join('');
    expect(unit).toBe('hhqqqeeess');
  });
  it('11레벨부터 16분음표, 레벨마다 BPM +10, 간격 최소 80', () => {
    expect(speedForLevel(11)).toMatchObject({ unit: 's', bpm: 130, intervalMs: 115 });
    expect(speedForLevel(12).bpm).toBe(140);
    expect(speedForLevel(16).intervalMs).toBe(83);
    expect(speedForLevel(17).intervalMs).toBe(80);
    expect(speedForLevel(40).intervalMs).toBe(80);
  });
  it('6칸 보드는 간격 × 1.3, 다른 폭은 그대로', () => {
    expect(dropIntervalMs(1, 6)).toBe(1560);
    expect(dropIntervalMs(4, 6)).toBe(650);
    expect(dropIntervalMs(1, 8)).toBe(1200);
    expect(dropIntervalMs(1, 12)).toBe(1200);
  });
  it('레벨 업: 10마디마다', () => {
    expect(levelFor(1, 0)).toBe(1);
    expect(levelFor(1, 9)).toBe(1);
    expect(levelFor(1, 10)).toBe(2);
    expect(levelFor(3, 25)).toBe(5);
  });
});

describe('§9 연주 큐: 다음 박 경계·최대 3마디', () => {
  const E = 96; // PPQ 192 의 8분음표
  it('4/4: 박(2칸)마다 시작할 수 있다', () => {
    const m = getMeter('4/4');
    expect(startCells(m)).toEqual([0, 2, 4, 6]);
    expect(nextBoundaryTick(0, m, E)).toBe(0);
    expect(nextBoundaryTick(1, m, E)).toBe(2 * E);
    expect(nextBoundaryTick(2 * E + 5, m, E)).toBe(4 * E);
    expect(nextBoundaryTick(7 * E + 1, m, E)).toBe(8 * E);
  });
  it('6/8: 점4분음표 박(3칸)마다', () => {
    const m = getMeter('6/8');
    expect(nextBoundaryTick(1, m, E)).toBe(3 * E);
    expect(nextBoundaryTick(4 * E, m, E)).toBe(6 * E);
  });
  it('7/8(2+2+3): 박 길이가 달라 마디 첫 칸에서만 시작(박 묶음이 메트로놈과 어긋나지 않게)', () => {
    const m = getMeter('7/8');
    expect(startCells(m)).toEqual([0]);
    expect(nextBoundaryTick(1, m, E)).toBe(7 * E);
  });
  it('큐 최대 3, 넘치면 가장 오래된 것을 버린다', () => {
    const q = new BoundedQueue<number>(3);
    expect(q.push(1)).toBeUndefined();
    q.push(2);
    q.push(3);
    expect(q.push(4)).toBe(1);
    expect(q.items).toEqual([2, 3, 4]);
    expect(q.shift()).toBe(2);
  });
});

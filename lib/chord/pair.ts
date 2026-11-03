// 조각(쌍) — 설계서 §4.4·§5.3·§5.4
//   위성은 축의 위(0)·오른쪽(1)·아래(2)·왼쪽(3). 시계 회전: 0→1→2→3→0.
//   킥: 목표 칸이 벽이나 타일이면 축을 반대쪽으로 1칸 밀어서 회전(위성을 아래로 돌릴 자리가 막히면 축이 위로 1칸).
//   180° 뒤집기: 양쪽이 다 막힌 1칸 폭 틈에서 회전을 300ms 안에 두 번(엔진이 시각을 보고 tryFlip 을 부른다).
//   분리 낙하: 한쪽이라도 막히면 그 타일은 고정, 다른 타일은 혼자 끝까지 떨어진다.
import { SPAWN_X, SPAWN_Y, applyGravity, inBounds, isFree, type FallMove } from './board';
import type { ActivePair, Board, Cell, Dir, Pair, Pitch } from './types';

export const DIR_OFFSET: Record<Dir, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

export function satellitePos(p: Pick<Pair, 'x' | 'y' | 'dir'>): Cell {
  const [dx, dy] = DIR_OFFSET[p.dir];
  return [p.x + dx, p.y + dy];
}

/** 쌍이 이 자리에 놓일 수 있는가(두 칸 모두 보드 안·빈칸) */
export function canPlace(b: Board, x: number, y: number, dir: Dir): boolean {
  const [dx, dy] = DIR_OFFSET[dir];
  return isFree(b, x, y) && isFree(b, x + dx, y + dy);
}

export function spawnPair(axis: Pitch, satellite: Pitch): Pair {
  return { axis, satellite, x: SPAWN_X, y: SPAWN_Y, dir: 0 };
}

export function tryMove<P extends Pair>(b: Board, p: P, dx: number, dy: number): P | null {
  return canPlace(b, p.x + dx, p.y + dy, p.dir) ? { ...p, x: p.x + dx, y: p.y + dy } : null;
}

/** dir 로 돌리기. 막히면 축을 반대쪽으로 1칸 밀어 본다(킥). 둘 다 안 되면 null */
export function rotateTo<P extends Pair>(b: Board, p: P, dir: Dir): P | null {
  if (canPlace(b, p.x, p.y, dir)) return { ...p, dir };
  const [dx, dy] = DIR_OFFSET[dir];
  const kx = p.x - dx;
  const ky = p.y - dy;
  // 밀린 축 자리가 비어 있으면, 위성은 원래 축 자리로 간다(그 칸은 조각 자신이 있던 칸이라 비어 있다)
  if (canPlace(b, kx, ky, dir)) return { ...p, x: kx, y: ky, dir };
  return null;
}

export function tryRotate<P extends Pair>(b: Board, p: P, cw: boolean): P | null {
  return rotateTo(b, p, (((p.dir + (cw ? 1 : 3)) % 4) as Dir));
}

/** 180° 뒤집기(위성 0↔2, 1↔3) — 킥 규칙은 회전과 같다 */
export function tryFlip<P extends Pair>(b: Board, p: P): P | null {
  return rotateTo(b, p, (((p.dir + 2) % 4) as Dir));
}

/** 쌍이 한 덩어리로 내려갈 수 있는 칸 수(두 타일 아래가 모두 비어 있는 동안) */
export function dropDistance(b: Board, p: Pair): number {
  let d = 0;
  while (canPlace(b, p.x, p.y + d + 1, p.dir)) d++;
  return d;
}

/** 쌍의 두 칸과 음 */
export function pairTiles(p: ActivePair): { id: number; x: number; y: number; pitch: Pitch; role: 'axis' | 'sat' }[] {
  const [sx, sy] = satellitePos(p);
  return [
    { id: p.axisId, x: p.x, y: p.y, pitch: p.axis, role: 'axis' },
    { id: p.satId, x: sx, y: sy, pitch: p.satellite, role: 'sat' },
  ];
}

export interface LockResult {
  /** 착지한 두 타일의 최종 자리 */
  landed: { id: number; x: number; y: number; pitch: Pitch }[];
  /** 혼자 더 떨어진 타일(분리 낙하) */
  splitMoves: FallMove[];
  maxSplit: number;
  /** 보드 위(숨김 줄보다 위)로 밀려나 버려진 타일 수 */
  discarded: number;
}

/** 쌍을 보드에 고정한다. 한쪽 아래가 비어 있으면 그 타일만 혼자 떨어진다(§5.4). 보드를 바꾼다 */
export function lockPair(b: Board, p: ActivePair): LockResult {
  let discarded = 0;
  for (const t of pairTiles(p)) {
    if (!inBounds(t.x, t.y)) {
      discarded++;
      continue;
    }
    b[t.y][t.x] = { id: t.id, kind: 'note', pitch: t.pitch };
  }
  const g = applyGravity(b);
  const landed: LockResult['landed'] = [];
  for (const t of pairTiles(p)) {
    const mv = g.moves.find((m) => m.id === t.id);
    if (!mv && !inBounds(t.x, t.y)) continue;
    landed.push({ id: t.id, x: t.x, y: mv ? mv.toY : t.y, pitch: t.pitch });
  }
  return { landed, splitMoves: g.moves, maxSplit: g.maxDrop, discarded };
}

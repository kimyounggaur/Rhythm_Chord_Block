// 보드 — 설계서 §4.1: 가로 7 × 세로 14(보이는 영역) + 맨 위 숨김 줄 1 = 15줄. board[y][x], y=0 숨김, y=14 바닥.
// 숨김 줄의 타일은 유지되지만 판정(§7)에 들어가지 않는다. 그보다 위로 밀려나는 타일은 버린다.
import type { Board, Cell, Tile } from './types';

export const COLS = 7;
export const ROWS = 15; // y = 0..14
export const VISIBLE_ROWS = 14;
export const HIDDEN_ROW = 0;
export const FLOOR_Y = 14;
export const SPAWN_X = 3;
export const SPAWN_Y = 1;

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Tile | null>(COLS).fill(null));
}

/** 줄 배열만 새로 만든다(타일 객체는 바꾸지 않으므로 함께 써도 된다) */
export function cloneBoard(b: Board): Board {
  return b.map((row) => row.slice());
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

export function tileAt(b: Board, x: number, y: number): Tile | null {
  return inBounds(x, y) ? b[y][x] : null;
}

/** 보드 안이고 비어 있으면 true */
export function isFree(b: Board, x: number, y: number): boolean {
  return inBounds(x, y) && b[y][x] === null;
}

export interface FallMove {
  id: number;
  x: number;
  fromY: number;
  toY: number;
}

/** 모든 타일이 수직으로 떨어진다(§7 applyGravity). 보드를 바꾸고 움직인 타일 목록을 돌려준다 */
export function applyGravity(b: Board): { moves: FallMove[]; maxDrop: number } {
  const moves: FallMove[] = [];
  let maxDrop = 0;
  for (let x = 0; x < COLS; x++) {
    let write = ROWS - 1;
    for (let y = ROWS - 1; y >= 0; y--) {
      const t = b[y][x];
      if (!t) continue;
      if (y !== write) {
        b[write][x] = t;
        b[y][x] = null;
        moves.push({ id: t.id, x, fromY: y, toY: write });
        maxDrop = Math.max(maxDrop, write - y);
      }
      write--;
    }
  }
  return { moves, maxDrop };
}

export function removeCells(b: Board, cells: Cell[]) {
  for (const [x, y] of cells) if (inBounds(x, y)) b[y][x] = null;
}

/** 열 높이 = 바닥부터 쌓인 칸 수(숨김 줄 포함, 0~15) */
export function columnHeight(b: Board, x: number): number {
  for (let y = 0; y < ROWS; y++) if (b[y][x]) return ROWS - y;
  return 0;
}

export function maxColumnHeight(b: Board): number {
  let m = 0;
  for (let x = 0; x < COLS; x++) m = Math.max(m, columnHeight(b, x));
  return m;
}

export function isEmptyBoard(b: Board): boolean {
  return b.every((row) => row.every((t) => t === null));
}

/** 공중에 뜬 타일이 없으면 true */
export function isSettled(b: Board): boolean {
  for (let x = 0; x < COLS; x++) {
    let seenEmpty = false;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (!b[y][x]) seenEmpty = true;
      else if (seenEmpty) return false;
    }
  }
  return true;
}

export function forEachTile(b: Board, fn: (t: Tile, x: number, y: number) => void) {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = b[y][x];
    if (t) fn(t, x, y);
  }
}

export function countTiles(b: Board): number {
  let n = 0;
  forEachTile(b, () => n++);
  return n;
}

export function maxTileId(b: Board): number {
  let m = 0;
  forEachTile(b, (t) => (m = Math.max(m, t.id)));
  return m;
}

export function cellKey(x: number, y: number): number {
  return y * COLS + x;
}

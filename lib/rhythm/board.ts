// 보드 연산(§4.1): 가로 W = 박자표의 8분음표 수, 세로 18줄(보이는 16 + 숨김 2). board[y][x], y=0 맨 위.
import { pieceCells, type XY } from './srs';
import { BOARD_ROWS, HIDDEN_ROWS, type ActivePiece, type Board, type Cell } from './types';

export function createBoard(width: number, rows = BOARD_ROWS): Board {
  return Array.from({ length: rows }, () => Array<Cell | null>(width).fill(null));
}

export function boardWidth(board: Board): number {
  return board[0]?.length ?? 0;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function activeCells(p: ActivePiece): XY[] {
  return pieceCells(p.type, p.rotation, p.x, p.y);
}

/** 칸들이 보드 밖이거나 이미 찬 칸과 겹치면 true */
export function collides(board: Board, cells: readonly XY[]): boolean {
  const h = board.length;
  const w = boardWidth(board);
  for (const [x, y] of cells) {
    if (x < 0 || x >= w || y < 0 || y >= h) return true;
    if (board[y][x]) return true;
  }
  return false;
}

export function fits(board: Board, p: ActivePiece): boolean {
  return !collides(board, activeCells(p));
}

/** 바닥(또는 블록)까지 떨어질 수 있는 칸 수 */
export function dropDistance(board: Board, p: ActivePiece): number {
  let d = 0;
  while (fits(board, { ...p, y: p.y + d + 1 })) d++;
  return d;
}

export function placePiece(board: Board, p: ActivePiece): void {
  for (const [x, y] of activeCells(p)) board[y][x] = { pieceId: p.id, type: p.type };
}

export function isRowFull(row: readonly (Cell | null)[]): boolean {
  return row.every((c) => c !== null);
}

export function isRowEmpty(row: readonly (Cell | null)[]): boolean {
  return row.every((c) => c === null);
}

/** 꽉 찬 줄의 y (위→아래 순) */
export function fullRows(board: Board): number[] {
  const out: number[] = [];
  board.forEach((row, y) => {
    if (isRowFull(row)) out.push(y);
  });
  return out;
}

/** 줄을 지우고 위의 줄을 그대로 내린다(일반 규칙과 같음, §6.1). 새 보드를 돌려준다 */
export function removeRows(board: Board, ys: readonly number[]): Board {
  const set = new Set(ys);
  const w = boardWidth(board);
  const kept = board.filter((_, y) => !set.has(y)).map((r) => r.slice());
  while (kept.length < board.length) kept.unshift(Array<Cell | null>(w).fill(null));
  return kept;
}

export function isBoardEmpty(board: Board): boolean {
  return board.every(isRowEmpty);
}

/** 조각 전체가 보이는 영역 위(y<2)에 있는가 — 그렇게 잠기면 게임 오버(§6.1) */
export function entirelyHidden(cells: readonly XY[]): boolean {
  return cells.every(([, y]) => y < HIDDEN_ROWS);
}

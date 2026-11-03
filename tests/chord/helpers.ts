// 화음 모드 테스트 도우미 — 설계서 §18 표기(아래 줄이 바닥, 보이는 줄만)
import { parseGrid } from '@/lib/chord/grid';
import type { Board, Cell, ChordId } from '@/lib/chord/types';

export const MAJOR: ChordId[] = ['I', 'IV', 'V'];
export const RULES = { activeChords: MAJOR, minGroup: 4 };

/** 'C E . . . . .' 같은 줄 여러 개 → 보드 */
export function grid(...rows: string[]): Board {
  return parseGrid(rows).board;
}

export function cellSet(cells: Cell[]): string[] {
  return cells.map(([x, y]) => `${x},${y}`).sort();
}

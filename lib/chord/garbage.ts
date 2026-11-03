// 비화음 타일(방해) 공급 — 설계서 §6.3 (1인 모드)
//   스테이지 8부터 12초마다 2 + floor(레벨/3)개(최대 6)가 서로 다른 열 위에서 떨어진다.
//   조작 중이면 현재 조각이 착지한(그리고 연쇄가 끝난) 뒤에 떨어진다 — 엔진이 '등장' 직전에 넣는다.
//   숨김 줄보다 위로 밀려나는 타일은 버린다(§4.1).
import { COLS, ROWS } from './board';
import type { Rng } from './spawn';
import type { Board, GarbageRules } from './types';

export function garbageCount(level: number, g: Pick<GarbageRules, 'base' | 'max'>): number {
  return Math.min(g.max, g.base + Math.floor(level / 3));
}

export interface GarbageDrop {
  placed: { id: number; x: number; y: number }[];
  discarded: number;
  maxDrop: number; // 숨김 줄(y=0)에서 내려앉은 칸 수의 최대
  nextId: number;
}

/** count 개를 서로 다른 열에 떨어뜨린다(7개를 넘으면 한 줄씩 채운 뒤 나머지를 서로 다른 열에). 보드를 바꾼다 */
export function dropGarbage(board: Board, count: number, rng: Rng, nextId: number): GarbageDrop {
  const placed: GarbageDrop['placed'] = [];
  let discarded = 0;
  let maxDrop = 0;
  let id = nextId;
  let left = count;
  while (left > 0) {
    const n = Math.min(COLS, left);
    left -= n;
    const cols = Array.from({ length: COLS }, (_, i) => i);
    for (let i = cols.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [cols[i], cols[j]] = [cols[j], cols[i]];
    }
    for (const x of cols.slice(0, n).sort((a, b) => a - b)) {
      let y = ROWS - 1;
      while (y >= 0 && board[y][x]) y--;
      if (y < 0) {
        discarded++;
        continue;
      }
      board[y][x] = { id, kind: 'garbage', pitch: null };
      placed.push({ id, x, y });
      maxDrop = Math.max(maxDrop, y);
      id++;
    }
  }
  return { placed, discarded, maxDrop, nextId: id };
}

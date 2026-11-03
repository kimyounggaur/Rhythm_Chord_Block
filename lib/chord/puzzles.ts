// 연쇄 퍼즐(설계서 부록 C, §17 M10) — 판 검사와 풀이 찾기(테스트에서 "손으로 만든 퍼즐이 정말 풀리는가"를 확인한다).
// 놓는 방법은 실제 조작과 같다: 등장 자리 (3,1)에서 회전(킥 포함) → 좌우 이동 → 하드 드롭. 막혀서 못 가는 자리는 빼고 센다.
import { cloneBoard, isSettled } from './board';
import { resolve, type ResolveResult } from './chain';
import { puzzleRules, type PuzzleDef } from './defs';
import { parseGrid } from './grid';
import { dropDistance, lockPair, spawnPair, tryMove, tryRotate } from './pair';
import { findPops } from './pops';
import { seqContains } from './progression';
import type { ActivePair, Board, Dir, Pitch } from './types';

export interface Placement {
  x: number;
  dir: Dir;
}

export const ALL_PLACEMENTS: Placement[] = (() => {
  const out: Placement[] = [];
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    for (let x = 0; x < 7; x++) {
      if (dir === 1 && x === 6) continue;
      if (dir === 3 && x === 0) continue;
      out.push({ x, dir });
    }
  }
  return out;
})();

export interface PuzzleCheck {
  settled: boolean;
  popsAtStart: boolean;
  solutions: Placement[][];
}

export function puzzleGoalMet(p: PuzzleDef, r: ResolveResult): boolean {
  return r.chain >= p.goal.chain && (!p.goal.progression || seqContains(r.progression, p.goal.progression));
}

/** 모든 놓는 방법을 차례로 해 본다(조각 수가 적어서 금방 끝난다) */
export function solvePuzzle(p: PuzzleDef, maxSolutions = 50): PuzzleCheck {
  const rules = puzzleRules(p);
  const start = parseGrid(p.board).board;
  const solutions: Placement[][] = [];
  const popsAtStart = findPops(start, rules.activeChords, rules).events.length > 0;

  const dfs = (board: Board, i: number, path: Placement[]) => {
    if (solutions.length >= maxSolutions || i >= p.pairs.length) return;
    const [a, s] = p.pairs[i];
    const seen = new Set<string>();
    for (const at of ALL_PLACEMENTS) {
      const placed = placePair(board, a, s, at);
      if (!placed) continue;
      const key = placed.map((r) => r.join('')).join('/');
      if (seen.has(key)) continue; // 같은 결과(같은 음 쌍 등)는 한 번만
      seen.add(key);
      const r = resolve(placed, rules);
      if (puzzleGoalMet(p, r)) {
        solutions.push([...path, at]);
        continue;
      }
      if (r.board[1][3]) continue; // 게임 오버
      dfs(r.board, i + 1, [...path, at]);
    }
  };
  dfs(start, 0, []);
  return { settled: isSettled(start), popsAtStart, solutions };
}

let freshId = 100000;

/** 등장 자리에서 실제 조작으로 그 자리까지 가서(회전 → 이동) 하드 드롭한 보드. 못 가면 null(연쇄 해결 전) */
export function placePair(board: Board, axis: Pitch, sat: Pitch, at: Placement): Board | null {
  let p: ActivePair | null = { ...spawnPair(axis, sat), axisId: 9001, satId: 9002 };
  let guard = 0;
  while (p && p.dir !== at.dir && guard++ < 4) p = tryRotate(board, p, true);
  if (!p || p.dir !== at.dir) return null;
  while (p && p.x !== at.x) p = tryMove(board, p, at.x > p.x ? 1 : -1, 0);
  if (!p) return null;
  const b = cloneBoard(board);
  lockPair(b, { ...p, y: p.y + dropDistance(b, p) });
  // 타일 id 가 겹치지 않게 새 번호를 준다
  for (const row of b) for (let x = 0; x < row.length; x++) if (row[x] && (row[x]!.id === 9001 || row[x]!.id === 9002)) row[x] = { ...row[x]!, id: freshId++ };
  return b;
}

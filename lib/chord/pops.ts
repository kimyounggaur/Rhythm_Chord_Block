// 터뜨리기 판정 엔진 — 설계서 §7 (핵심). 순수 함수: 게임 상태·화면과 분리해 단위 테스트한다.
//   1. 판정 대상 = y=1~14 의 계이름 타일(숨김 줄·비화음 제외)
//   2. 활성 화음마다 따로 BFS(도는 Ⅰ·Ⅳ, 솔은 Ⅰ·Ⅴ 양쪽 덩어리에 들어갈 수 있다)
//   3. 크기 ≥ minGroup 이고 구성음이 모두 있으면 PopEvent (Ⅴ7: 파까지 있으면 Ⅴ7, 솔·시·레만 있으면 Ⅴ)
//   4. 터지는 타일과 상하좌우로 맞닿은 비화음·비활성 화음 타일도 제거(점수에는 세지 않음)
//   5. 두 이벤트가 같은 칸을 가지면 sharedCells 에 기록, 제거는 한 번만
import { COLS, ROWS, cellKey } from './board';
import { activeTones, chordOf, judgedChords } from './defs';
import type { Board, Cell, Chord, ChordId, Pitch, PopEvent, PopResult } from './types';

const NB: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 판정 영역(보이는 14줄) 안인가 */
export function judged(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 1 && y < ROWS;
}

/** 화음 하나의 덩어리(BFS) 전부 — 크기와 상관없이 */
export function chordGroups(board: Board, chord: Chord): Cell[][] {
  const tones = new Set<Pitch>(chord.tones);
  const seen = new Uint8Array(COLS * ROWS);
  const groups: Cell[][] = [];
  for (let y = 1; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = board[y][x];
      if (!t || t.kind !== 'note' || !tones.has(t.pitch!) || seen[cellKey(x, y)]) continue;
      const comp: Cell[] = [];
      const queue: Cell[] = [[x, y]];
      seen[cellKey(x, y)] = 1;
      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        comp.push([cx, cy]);
        for (const [dx, dy] of NB) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!judged(nx, ny) || seen[cellKey(nx, ny)]) continue;
          const n = board[ny][nx];
          if (!n || n.kind !== 'note' || !tones.has(n.pitch!)) continue;
          seen[cellKey(nx, ny)] = 1;
          queue.push([nx, ny]);
        }
      }
      groups.push(comp);
    }
  }
  return groups;
}

export function toneCountsOf(board: Board, cells: Cell[]): Partial<Record<Pitch, number>> {
  const c: Partial<Record<Pitch, number>> = {};
  for (const [x, y] of cells) {
    const p = board[y][x]!.pitch!;
    c[p] = (c[p] ?? 0) + 1;
  }
  return c;
}

/** 덩어리가 터진다면 어느 화음으로 터지는가(Ⅴ7 → Ⅴ 대체 포함). 안 터지면 null */
export function popChordFor(chord: Chord, counts: Partial<Record<Pitch, number>>, size: number, minGroup: number): ChordId | null {
  if (size < minGroup) return null;
  const has = (p: Pitch) => (counts[p] ?? 0) > 0;
  const required = chord.requiredTones ?? chord.tones;
  if (required.every(has)) return chord.id;
  if (chord.fallback && chordOf(chord.fallback).tones.every(has)) return chord.fallback;
  return null;
}

export function findPops(board: Board, activeChords: ChordId[], rules: { minGroup: number }): PopResult {
  const events: PopEvent[] = [];
  const hits = new Map<number, number>(); // 칸 → 몇 개 이벤트에 들었나
  for (const chord of judgedChords(activeChords)) {
    for (const comp of chordGroups(board, chord)) {
      const counts = toneCountsOf(board, comp);
      const id = popChordFor(chord, counts, comp.length, rules.minGroup);
      if (!id) continue;
      events.push({ chord: id, cells: comp, size: comp.length, toneCounts: counts });
      for (const [x, y] of comp) hits.set(cellKey(x, y), (hits.get(cellKey(x, y)) ?? 0) + 1);
    }
  }

  const removedCells: Cell[] = [];
  const sharedCells: Cell[] = [];
  for (const [k, n] of hits) {
    const cell: Cell = [k % COLS, Math.floor(k / COLS)];
    removedCells.push(cell);
    if (n > 1) sharedCells.push(cell);
  }
  const poppedCount = removedCells.length;

  // 맞닿은 비화음(방해) 타일과 비활성 화음 타일 — 판정 영역 안에서만
  const tones = activeTones(activeChords);
  const junkCells: Cell[] = [];
  const junkSeen = new Set<number>();
  for (const [x, y] of removedCells) {
    for (const [dx, dy] of NB) {
      const nx = x + dx;
      const ny = y + dy;
      if (!judged(nx, ny)) continue;
      const k = cellKey(nx, ny);
      if (hits.has(k) || junkSeen.has(k)) continue;
      const n = board[ny][nx];
      if (!n) continue;
      if (n.kind === 'garbage' || !tones.has(n.pitch!)) {
        junkSeen.add(k);
        junkCells.push([nx, ny]);
      }
    }
  }

  return {
    events,
    removedCells: [...removedCells, ...junkCells],
    poppedCount,
    sharedCount: sharedCells.length,
    sharedCells,
    junkCells,
  };
}

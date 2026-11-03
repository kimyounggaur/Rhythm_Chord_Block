// 학습 피드백 계산 — 설계서 §14-1·§14-2 (순수 함수)
//   부족한 음 힌트: 크기 3 이상 덩어리에서 구성음이 하나만 빠지면 그 음, 구성음은 다 있는데 크기가 3이면 "+1".
//                  한 번에 최대 3개(큰 덩어리 우선). 덩어리 맨 위 타일에 배지.
//   덩어리 받침대: 크기 2 이상 같은 화음 덩어리. 공통음 타일은 두 화음 반반(에셋 README "덩어리 받침대"의 haloNames 와 같은 계산).
import { COLS, ROWS } from './board';
import { chordOf, judgedChords } from './defs';
import { chordGroups, popChordFor, toneCountsOf } from './pops';
import type { Board, Cell, ChordId, Pitch } from './types';

export interface Hint {
  chord: ChordId;
  /** 빠진 음. null 이면 "+1"(구성음은 다 있고 한 칸 모자람) */
  missing: Pitch | null;
  size: number;
  cells: Cell[];
  /** 배지를 얹을 타일 = 덩어리 맨 위(같은 줄이면 오른쪽) */
  anchor: Cell;
}

export function findHints(board: Board, activeChords: ChordId[], minGroup = 4, max = 3): Hint[] {
  const all: Hint[] = [];
  for (const chord of judgedChords(activeChords)) {
    // Ⅴ7 은 솔·시·레만 있어도 Ⅴ 로 터지므로, 힌트는 터지는 데 꼭 필요한 음(대체 화음의 구성음)을 기준으로 한다
    const need = chord.fallback ? chordOf(chord.fallback).tones : chord.requiredTones ?? chord.tones;
    for (const comp of chordGroups(board, chord)) {
      if (comp.length < 3) continue;
      const counts = toneCountsOf(board, comp);
      if (popChordFor(chord, counts, comp.length, minGroup)) continue; // 곧 터질 덩어리(정착된 보드에는 없다)
      const missing = need.filter((p) => !(counts[p] ?? 0));
      let hint: Pitch | null | undefined;
      if (missing.length === 1) hint = missing[0];
      else if (missing.length === 0 && comp.length === minGroup - 1) hint = null;
      else continue;
      all.push({ chord: chord.id, missing: hint, size: comp.length, cells: comp, anchor: topCell(comp) });
    }
  }
  all.sort((a, b) => b.size - a.size);
  return all.slice(0, max);
}

function topCell(cells: Cell[]): Cell {
  let best = cells[0];
  for (const c of cells) if (c[1] < best[1] || (c[1] === best[1] && c[0] > best[0])) best = c;
  return best;
}

const HALO_ORDER = ['i', 'iv', 'v', 'v7'] as const;

/** 칸("x,y") → 받침대 그림 이름(예: 'i', 'i-iv', 'iv-v7'). 보이는 줄만 */
export function haloMap(board: Board, activeChords: ChordId[]): Map<string, string> {
  const names = new Map<string, string[]>();
  for (const chord of judgedChords(activeChords)) {
    for (const comp of chordGroups(board, chord)) {
      if (comp.length < 2) continue;
      for (const [x, y] of comp) {
        const k = `${x},${y}`;
        const list = names.get(k) ?? [];
        if (!list.includes(chord.art.halo)) list.push(chord.art.halo);
        names.set(k, list);
      }
    }
  }
  const out = new Map<string, string>();
  for (const [k, list] of names) {
    const sorted = [...list].sort((a, b) => HALO_ORDER.indexOf(a as never) - HALO_ORDER.indexOf(b as never));
    out.set(k, sorted.join('-'));
  }
  return out;
}

/** 칸 → 그 칸이 든 덩어리 화음 목록(받침대와 같은 규칙, 테스트용) */
export function haloChords(board: Board, activeChords: ChordId[]): Map<string, ChordId[]> {
  const out = new Map<string, ChordId[]>();
  for (const chord of judgedChords(activeChords)) {
    for (const comp of chordGroups(board, chord)) {
      if (comp.length < 2) continue;
      for (const [x, y] of comp) out.set(`${x},${y}`, [...(out.get(`${x},${y}`) ?? []), chord.id]);
    }
  }
  return out;
}

export function boardCells(): Cell[] {
  const c: Cell[] = [];
  for (let y = 1; y < ROWS; y++) for (let x = 0; x < COLS; x++) c.push([x, y]);
  return c;
}

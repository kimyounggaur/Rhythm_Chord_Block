// 해결 루프 — 설계서 §7 resolve, §16 주의 2 "동기 계산 → 연출 큐".
// 먼저 전체 연쇄 결과(ChainResult)를 계산하고, 화면·소리는 frames/timeline 을 순서대로 재생한다.
//   연출 시간(§6.1): 타일 낙하 60ms/칸(한 번의 중력에 최대 240ms), 터짐 450ms, 연쇄 한 단계 ≈ 600~700ms.
//   낙하가 짧으면(1~2칸) 내려앉은 뒤 잠깐 멈춰 한 단계가 600ms 아래로 줄지 않게 한다(화음 진행이 들리도록, §9).
import { applyGravity, cloneBoard, isEmptyBoard, removeCells, type FallMove } from './board';
import { collectionsFor } from './collection';
import { findPops } from './pops';
import { scoreStep } from './score';
import type { Board, ChainResult, ChainStep, ChordId, PopResult } from './types';

export const TIMING = {
  fallPerCell: 60,
  fallMax: 240,
  /** 연쇄 중 중력 한 번의 최소 길이(낙하 + 멈춤) — 450 + 150 = 600ms */
  fallPhaseMin: 150,
  pop: 450,
  /** 조작 중 분리 낙하(혼자 떨어지는 타일) */
  splitPerCell: 60,
  splitMax: 240,
};

export function fallMs(cells: number): number {
  return Math.min(TIMING.fallMax, TIMING.fallPerCell * cells);
}

export interface ResolveFrame {
  kind: 'fall' | 'pop';
  /** 이 장면에서 보여 줄 보드(낙하: 내려앉은 뒤, 터짐: 터지기 직전) */
  board: Board;
  moves?: FallMove[];
  maxDrop?: number;
  pops?: PopResult;
  step?: ChainStep;
}

export interface ResolveResult extends ChainResult {
  collectionIds: string[];
  frames: ResolveFrame[];
  /** 연쇄가 끝난 뒤 보드 */
  board: Board;
}

export interface ResolveRules {
  activeChords: ChordId[];
  minGroup: number;
}

/** 입력 보드는 바꾸지 않는다 */
export function resolve(start: Board, rules: ResolveRules): ResolveResult {
  const board = cloneBoard(start);
  const steps: ChainStep[] = [];
  const frames: ResolveFrame[] = [];
  let chain = 0;
  for (;;) {
    const g = applyGravity(board);
    if (g.moves.length) frames.push({ kind: 'fall', board: cloneBoard(board), moves: g.moves, maxDrop: g.maxDrop });
    const pops = findPops(board, rules.activeChords, rules);
    if (!pops.events.length) break;
    chain += 1;
    const step = scoreStep(pops, chain, steps);
    steps.push(step);
    frames.push({ kind: 'pop', board: cloneBoard(board), pops, step });
    removeCells(board, pops.removedCells);
    if (chain > 200) throw new Error('연쇄가 끝나지 않아요(엔진 오류)');
  }
  const progression = steps.map((s) => s.mainChord);
  const collectionIds = chain ? collectionsFor(steps, progression) : [];
  return {
    steps,
    chain,
    progression,
    totalScore: steps.reduce((a, s) => a + s.score, 0),
    allClear: chain > 0 && isEmptyBoard(board),
    collectionId: collectionIds[0] ?? null,
    collectionIds,
    frames,
    board,
  };
}

export interface TimelinePhase {
  kind: 'fall' | 'pop';
  start: number;
  end: number;
  /** CSS 낙하 시간(낙하 장면만, 장면 길이보다 짧을 수 있다) */
  fallMs: number;
  frame: ResolveFrame;
}

export interface Timeline {
  phases: TimelinePhase[];
  total: number;
  /** 각 단계(1부터)의 터짐 시작 시각 — 소리 예약에 쓴다 */
  popAt: number[];
}

export function buildTimeline(frames: ResolveFrame[]): Timeline {
  const phases: TimelinePhase[] = [];
  const popAt: number[] = [];
  let t = 0;
  let afterPop = false;
  for (const f of frames) {
    if (f.kind === 'fall') {
      const ms = fallMs(f.maxDrop ?? 0);
      const dur = afterPop ? Math.max(TIMING.fallPhaseMin, ms) : ms;
      phases.push({ kind: 'fall', start: t, end: t + dur, fallMs: ms, frame: f });
      t += dur;
    } else {
      popAt.push(t);
      phases.push({ kind: 'pop', start: t, end: t + TIMING.pop, fallMs: 0, frame: f });
      t += TIMING.pop;
      afterPop = true;
    }
  }
  return { phases, total: t, popAt };
}

// 스테이지 목표 판정 — 설계서 §12 (목표를 채우면 클리어, 다음 해금)
// 목표가 여럿이면(스테이지 2·3·5·10) 모두 채워야 한다(부록 B 아래 주석: "목표 3개를 배열로" 방식을 골랐다).
import { chordOf } from './defs';
import { chordMatches, lookupProgression, seqMatches } from './progression';
import type { ChainResult, ChordId, Goal } from './types';

function lookupGoalName(seq: ChordId[]): string {
  return seq.length === 2 ? lookupProgression(seq[0], seq[1])?.name ?? '' : '';
}

export interface GoalProgress {
  goal: Goal;
  value: number;
  done: boolean;
}

export function initGoals(goals: Goal[]): GoalProgress[] {
  return goals.map((g) => ({ goal: g, value: 0, done: false }));
}

/** 연쇄 한 번이 이 목표에 몇을 더하는가 */
export function goalGain(goal: Goal, r: ChainResult): number {
  switch (goal.type) {
    case 'pops':
      return r.steps.reduce((a, s) => a + s.events.length, 0);
    case 'chordPops':
      return r.steps.reduce((a, s) => a + s.events.filter((e) => e.chord === goal.chord).length, 0);
    case 'cadence': {
      const [a, b] = goal.progression ?? [];
      return r.steps.filter((s) => s.pairFrom && s.pairTo && s.pairBonus > 0 && chordMatches(s.pairFrom, a) && chordMatches(s.pairTo, b)).length;
    }
    case 'progression': {
      const seq = goal.progression ?? [];
      let n = 0;
      for (let end = seq.length; end <= r.progression.length; end++) if (seqMatches(r.progression.slice(end - seq.length, end), seq)) n++;
      return n;
    }
    case 'shared':
      return r.steps.filter((s) => s.sharedCount > 0).length;
    default:
      return 0;
  }
}

/** 연쇄가 끝날 때(점수·조각 수 목표는 값 자체로) 진행도를 고친다 */
export function updateGoals(progress: GoalProgress[], r: ChainResult | null, totals: { pieces: number; score: number }): GoalProgress[] {
  return progress.map((p) => {
    let value = p.value;
    if (p.goal.type === 'survive') value = totals.pieces;
    else if (p.goal.type === 'score') value = totals.score;
    else if (r) value += goalGain(p.goal, r);
    return { goal: p.goal, value, done: value >= p.goal.count };
  });
}

export function allGoalsDone(progress: GoalProgress[]): boolean {
  return progress.length > 0 && progress.every((p) => p.done);
}

/** 목표 한 줄 설명(시작 카드·스테이지 선택) */
export function goalText(g: Goal): string {
  switch (g.type) {
    case 'pops':
      return `화음 ${g.count}번 터뜨리기`;
    case 'chordPops':
      return `${chordOf(g.chord!).roman} ${g.count}번 터뜨리기`;
    case 'cadence':
      return `${romanSeq(g.progression!)} ${lookupGoalName(g.progression!)} ${g.count}번`;
    case 'progression':
      return `${romanSeq(g.progression!)} ${g.progression!.length}연쇄 ${g.count}번`;
    case 'shared':
      return `공통음 동시 화음 ${g.count}번`;
    case 'survive':
      return `조각 ${g.count}개 버티기`;
    case 'score':
      return `${g.count}점 모으기`;
  }
}

/** 목표 짧은 이름(옆 패널) */
export function goalShort(g: Goal): string {
  switch (g.type) {
    case 'pops':
      return '화음';
    case 'chordPops':
      return chordOf(g.chord!).roman;
    case 'cadence':
    case 'progression':
      return romanSeq(g.progression!);
    case 'shared':
      return '공통음';
    case 'survive':
      return '조각';
    case 'score':
      return '점수';
  }
}

export function romanSeq(seq: ChordId[]): string {
  return seq.map((id) => chordOf(id).roman).join('→');
}

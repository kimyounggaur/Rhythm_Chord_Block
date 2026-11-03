// 패턴 도감(§11, 부록 B): 마디의 run 길이 배열이 도감의 패턴과 같으면 달성. 계이름은 보지 않는다.
import patternsJson from '@/data/rhythm/patterns.json';
import type { MeterId, Rules } from './types';

export interface PatternDef {
  id: string;
  name: string;
  runs: number[];
  requires?: 'ties';
}

const DATA = patternsJson as Partial<Record<MeterId, PatternDef[]>>;

/** 도감이 있는 박자표(부록 B 순서) */
export const PATTERN_METERS: readonly MeterId[] = (['4/4', '3/4', '6/8', '9/8', '12/8', '5/4', '7/8'] as MeterId[]).filter(
  (m) => (DATA[m]?.length ?? 0) > 0,
);

export function patternsFor(meterId: MeterId): PatternDef[] {
  return DATA[meterId] ?? [];
}

export function allPatterns(): { meterId: MeterId; def: PatternDef }[] {
  return PATTERN_METERS.flatMap((m) => patternsFor(m).map((def) => ({ meterId: m, def })));
}

/** 저장 키: `${meterId}:${patternId}` (§15 SaveData.patterns) */
export function patternKey(meterId: MeterId, id: string): string {
  return `${meterId}:${id}`;
}

export function getPattern(meterId: MeterId, id: string): PatternDef | undefined {
  return patternsFor(meterId).find((p) => p.id === id);
}

export function patternFromKey(key: string): { meterId: MeterId; def: PatternDef } | undefined {
  const i = key.lastIndexOf(':');
  const meterId = key.slice(0, i) as MeterId;
  const def = getPattern(meterId, key.slice(i + 1));
  return def ? { meterId, def } : undefined;
}

function sameRuns(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** run 길이 배열과 같은 패턴. `requires: 'ties'` 패턴은 붙임줄 규칙이 켜졌을 때만 */
export function findPattern(meterId: MeterId, runs: readonly number[], rules: Pick<Rules, 'ties'>): PatternDef | null {
  for (const p of patternsFor(meterId)) {
    if (p.requires === 'ties' && !rules.ties) continue;
    if (sameRuns(p.runs, runs)) return p;
  }
  return null;
}

/** 리듬 약어(§ 머리말): [3,1,3,1] → "q. e q. e", e×8 처럼 줄이지 않는다 */
export function runsToRhythm(runs: readonly number[]): string {
  const name: Record<number, string> = { 1: 'e', 2: 'q', 3: 'q.', 4: 'h', 6: 'h.', 8: 'w' };
  return runs.map((r) => name[r] ?? `${r}칸`).join(' ');
}

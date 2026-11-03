// 저장 데이터(SaveData, §15) 기본값과 도우미 — 실제 읽기/쓰기는 lib/music/storage.ts(localStorage, version 포함)
import { PUZZLES, STAGES, type PuzzleDef } from './defs';
import type { AutoBool, Rules, SaveData, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  tensionPad: true, // §19-9 "옵션, 기본 켬(작게)"
  volume: 0.8,
  controls: 'both',
  hints: 'auto',
  intervalLabel: 'auto',
  unlockAll: false,
};

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  highScores: {},
  clearedStages: [],
  collections: {},
  puzzlesSolved: [],
  settings: DEFAULT_SETTINGS,
};

/** 스테이지는 앞 스테이지를 깨면 열린다(1은 처음부터) */
export function isStageUnlocked(save: SaveData, id: number): boolean {
  if (save.settings.unlockAll || id <= 1) return true;
  return save.clearedStages.includes(id - 1) || save.clearedStages.includes(id);
}

/** 무한 모드는 클리어한 스테이지의 설정으로(§12) */
export function isEndlessUnlocked(save: SaveData, id: number): boolean {
  return save.settings.unlockAll || save.clearedStages.includes(id);
}

/** 퍼즐은 stageMin 스테이지가 열리면 연다 */
export function isPuzzleUnlocked(save: SaveData, p: PuzzleDef): boolean {
  return isStageUnlocked(save, p.stageMin);
}

export function resolveAuto(v: AutoBool, stageDefault: boolean): boolean {
  return v === 'auto' ? stageDefault : v;
}

export function effectiveHints(settings: Settings, rules: Rules): boolean {
  return resolveAuto(settings.hints, rules.hints);
}

export function effectiveInterval(settings: Settings, rules: Rules): boolean {
  return resolveAuto(settings.intervalLabel, rules.intervalLabel);
}

export function highScoreKey(mode: 'campaign' | 'endless', stageId: number): string {
  return `${mode === 'campaign' ? 'stage' : 'endless'}-${stageId}`;
}

export function stageCount(): number {
  return STAGES.length;
}

export function puzzleCount(): number {
  return PUZZLES.length;
}

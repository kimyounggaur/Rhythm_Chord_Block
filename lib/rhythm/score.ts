// 점수 — 설계서 §10. 항목별 내역(breakdown)을 만들어 떠오르는 글자로 보여 준다.
import { ROMAN } from '@/lib/music/chords';
import type { MeasureResult, ScoreItem } from './types';

export const SCORE = {
  /** n마디 동시 완성 × 레벨 (1=마디 완성, 2=동기, 3, 4=작은악절) */
  lines: { 1: 100, 2: 300, 3: 500, 4: 800 } as Record<number, number>,
  syncopation: 50, // 당김음 음표 1개 × 레벨
  chord: 200, // 화음 마디 × 레벨
  patternFirst: 500, // 패턴 첫 달성 (도감 등록)
  patternRepeat: 100, // 패턴 재달성
  comboStep: 50, // 콤보 수 × 50
  perfectClear: 1000,
  softDropCell: 1,
  hardDropCell: 2,
  tieNote: 30, // 붙임줄 음표당
} as const;

export const LINES_LABEL: Record<number, string> = { 1: '마디 완성', 2: '동기!', 3: '3마디 동시!', 4: '작은악절!' };

export function linesPoints(n: number, level: number): number {
  const k = Math.max(1, Math.min(4, n));
  return SCORE.lines[k] * level;
}

export interface MeasureScoreInput {
  level: number;
  syncopationCount: number;
  syncopationBonus: boolean;
  chord: 'I' | 'IV' | 'V' | null;
  pattern: { name: string; first: boolean } | null;
  tiedNotes: number;
}

/** 한 마디의 점수 내역 (§7-9). 첫 항목은 '마디 완성 100×레벨' */
export function measureBreakdown(i: MeasureScoreInput): ScoreItem[] {
  const L = i.level;
  const items: ScoreItem[] = [{ label: LINES_LABEL[1], points: SCORE.lines[1] * L, kind: 'measure' }];
  if (i.syncopationBonus && i.syncopationCount > 0) {
    const n = i.syncopationCount;
    items.push({ label: n > 1 ? `당김음 ×${n}` : '당김음', points: SCORE.syncopation * n * L, kind: 'sync' });
  }
  if (i.chord) items.push({ label: `${ROMAN[i.chord]} 화음 마디`, points: SCORE.chord * L, kind: 'chord' });
  if (i.pattern) {
    items.push(
      i.pattern.first
        ? { label: `새 패턴 ${i.pattern.name}`, points: SCORE.patternFirst, kind: 'patternNew' }
        : { label: `패턴 ${i.pattern.name}`, points: SCORE.patternRepeat, kind: 'pattern' },
    );
  }
  if (i.tiedNotes > 0) {
    items.push({ label: i.tiedNotes > 1 ? `붙임줄 ×${i.tiedNotes}` : '붙임줄', points: SCORE.tieNote * i.tiedNotes, kind: 'tie' });
  }
  return items;
}

export function sumItems(items: readonly ScoreItem[]): number {
  return items.reduce((s, it) => s + it.points, 0);
}

/** 한 번의 잠금으로 생긴 점수. 줄마다의 항목은 y(그 줄)를 함께 적어 둔다 */
export interface PlacedItem extends ScoreItem {
  y: number | null;
}
export interface ClearScore {
  items: PlacedItem[];
  total: number;
}

/**
 * 여러 마디 동시 완성(§10): 줄마다의 '마디 완성 100' 대신 n마디 점수(300·500·800 × 레벨)를 한 번 준다.
 * 나머지 항목(당김음·화음·패턴·붙임줄)은 줄마다 그대로. 콤보·퍼펙트 클리어는 이번 잠금 전체에 한 번.
 * results 는 위→아래 순서.
 */
export function scoreClear(results: readonly MeasureResult[], level: number, combo: number, perfect: boolean): ClearScore {
  const n = results.length;
  const items: PlacedItem[] = [];
  if (n > 0) {
    const ys = results.map((r) => r.y);
    const midY = ys[Math.floor((ys.length - 1) / 2)];
    items.push({ label: LINES_LABEL[Math.min(4, n)], points: linesPoints(n, level), kind: n === 1 ? 'measure' : 'lines', y: midY });
  }
  for (const r of results) {
    for (const it of r.breakdown) {
      if (it.kind === 'measure') continue;
      items.push({ ...it, y: r.y });
    }
  }
  if (combo >= 1) items.push({ label: `${combo} 콤보`, points: SCORE.comboStep * combo, kind: 'combo', y: null });
  if (perfect) items.push({ label: '퍼펙트 클리어!', points: SCORE.perfectClear, kind: 'perfect', y: null });
  return { items, total: sumItems(items) };
}

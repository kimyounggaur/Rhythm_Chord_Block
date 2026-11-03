// 마디 판정 엔진 (§7, 핵심). 순수 함수 analyzeRow(row, meter, rules) → MeasureResult.
// 게임 상태·화면과 완전히 분리되어 있다. 점수 계산에 필요한 레벨·도감 상태는 4번째 인자(ctx)로 받는다(없으면 레벨 1, 도감 비어 있음).
import { triadOf } from '@/lib/music/chords';
import { toNotation } from './notation';
import { findPattern, patternKey } from './patterns';
import { measureBreakdown, sumItems } from './score';
import { PITCH_MAP, type Cell, type MeasureResult, type Meter, type NoteEvent, type PieceType, type Rules } from './types';

export interface AnalyzeContext {
  /** 줄의 y (보드 좌표) */
  y?: number;
  /** 지금 레벨(점수 배수). 기본 1 */
  level?: number;
  /** 도감에 이미 있는 패턴인가(키: `${meterId}:${patternId}`). 없으면 모두 처음 */
  isCollected?: (key: string) => boolean;
}

export interface Run {
  start: number;
  length: number;
  type: PieceType;
  pieceIds: number[];
}

/** 2. 음 나누기: x=0부터 pieceId 가 같은 연속 구간을 하나의 run 으로 */
export function splitRuns(row: readonly Cell[]): Run[] {
  const runs: Run[] = [];
  for (let x = 0; x < row.length; x++) {
    const c = row[x];
    const last = runs[runs.length - 1];
    if (last && last.pieceIds[last.pieceIds.length - 1] === c.pieceId && last.start + last.length === x) {
      last.length++;
    } else {
      runs.push({ start: x, length: 1, type: c.type, pieceIds: [c.pieceId] });
    }
  }
  return runs;
}

/** 4. 붙임줄: 인접 run 의 type 이 같으면 하나로 합친다 */
export function mergeTies(runs: readonly Run[]): (Run & { tied: boolean })[] {
  const out: (Run & { tied: boolean })[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.type === r.type) {
      last.length += r.length;
      last.pieceIds = [...last.pieceIds, ...r.pieceIds];
      last.tied = true;
    } else {
      out.push({ ...r, pieceIds: [...r.pieceIds], tied: false });
    }
  }
  return out;
}

/** 5. 당김음: strength[start] < max(strength[start+1 … start+length−1]). 길이 1이면 false */
export function isSyncopated(start: number, length: number, strength: readonly number[]): boolean {
  if (length <= 1) return false;
  let max = -1;
  for (let x = start + 1; x < start + length; x++) max = Math.max(max, strength[x] ?? 0);
  return strength[start] < max;
}

function incomplete(meter: Meter, y: number): MeasureResult {
  return {
    complete: false,
    y,
    meterId: meter.id,
    notes: [],
    notation: [],
    syncopationCount: 0,
    chord: null,
    patternId: null,
    score: 0,
    breakdown: [],
  };
}

export function analyzeRow(row: readonly (Cell | null)[], meter: Meter, rules: Rules, ctx: AnalyzeContext = {}): MeasureResult {
  const y = ctx.y ?? -1;
  const level = ctx.level ?? 1;
  // 1. 완성 확인
  if (row.length !== meter.width || row.some((c) => c === null)) return incomplete(meter, y);
  const cells = row as Cell[];

  // 2~4. run → 계이름 → 붙임줄
  const runs = splitRuns(cells);
  const merged = rules.ties ? mergeTies(runs) : runs.map((r) => ({ ...r, tied: false }));

  // 5. 당김음
  const notes: NoteEvent[] = merged.map((r) => ({
    pitch: PITCH_MAP[r.type],
    start: r.start,
    length: r.length,
    syncopated: isSyncopated(r.start, r.length, meter.strength),
    tied: r.tied,
    pieceIds: r.pieceIds,
  }));
  const syncopationCount = notes.filter((n) => n.syncopated).length;

  // 6. 화음 마디
  const chord = rules.chordBonus ? triadOf(notes.map((n) => n.pitch)) : null;

  // 7. 패턴 (붙임줄이 켜져 있으면 합친 길이 기준)
  const pattern = findPattern(
    meter.id,
    notes.map((n) => n.length),
    rules,
  );
  const patternOn = rules.patternBonus !== false;

  // 8. 표기
  const notation = toNotation(notes, meter, rules);

  // 9. 점수
  const breakdown = measureBreakdown({
    level,
    syncopationCount,
    syncopationBonus: rules.syncopationBonus,
    chord,
    pattern:
      pattern && patternOn ? { name: pattern.name, first: !(ctx.isCollected?.(patternKey(meter.id, pattern.id)) ?? false) } : null,
    tiedNotes: rules.ties ? notes.filter((n) => n.tied).length : 0,
  });

  return {
    complete: true,
    y,
    meterId: meter.id,
    notes,
    notation,
    syncopationCount,
    chord,
    patternId: pattern?.id ?? null,
    score: sumItems(breakdown),
    breakdown,
  };
}

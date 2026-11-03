// 속도 = 박 단위 낙하 (§6.2). 낙하 간격 = 현재 BPM에서 낙하 단위 음표 하나의 길이.
export type DropUnit = 'h' | 'q' | 'e' | 's'; // 2분·4분·8분·16분음표

export interface SpeedInfo {
  level: number;
  unit: DropUnit;
  bpm: number;
  /** 6칸 보정 전 간격(ms, 정수로 반올림 — 표의 429·214 와 같게) */
  intervalMs: number;
}

/** 낙하 단위 하나가 4분음표 몇 개인가 */
const UNIT_BEATS: Record<DropUnit, number> = { h: 2, q: 1, e: 0.5, s: 0.25 };

/** 레벨 1~10 표 그대로 */
const TABLE: ReadonlyArray<{ unit: DropUnit; bpm: number }> = [
  { unit: 'h', bpm: 100 },
  { unit: 'h', bpm: 120 },
  { unit: 'q', bpm: 100 },
  { unit: 'q', bpm: 120 },
  { unit: 'q', bpm: 140 },
  { unit: 'e', bpm: 100 },
  { unit: 'e', bpm: 120 },
  { unit: 'e', bpm: 140 },
  { unit: 's', bpm: 100 },
  { unit: 's', bpm: 120 },
];

/** 11레벨부터: 16분음표, 레벨마다 BPM +10, 간격 최소 80ms */
export const MIN_INTERVAL_MS = 80;
/** 6칸 보드(3/4·6/8)는 같은 레벨에서 간격 × 1.3 */
export const SIX_CELL_FACTOR = 1.3;
/** 레벨 업: 10마디마다 */
export const MEASURES_PER_LEVEL = 10;

export function speedForLevel(level: number): SpeedInfo {
  const lv = Math.max(1, Math.floor(level));
  const row = lv <= 10 ? TABLE[lv - 1] : { unit: 's' as DropUnit, bpm: 120 + 10 * (lv - 10) };
  const raw = (60000 / row.bpm) * UNIT_BEATS[row.unit];
  const intervalMs = Math.max(MIN_INTERVAL_MS, Math.round(raw));
  return { level: lv, unit: row.unit, bpm: row.bpm, intervalMs };
}

/** 실제 낙하 간격(ms). 보드 폭이 6칸이면 × 1.3 */
export function dropIntervalMs(level: number, boardWidth: number): number {
  const base = speedForLevel(level).intervalMs;
  return boardWidth === 6 ? Math.round(base * SIX_CELL_FACTOR) : base;
}

/** 스테이지 시작 레벨에서 10마디마다 1씩 오른다 */
export function levelFor(startLevel: number, measuresCleared: number): number {
  return startLevel + Math.floor(measuresCleared / MEASURES_PER_LEVEL);
}

/** 소프트 드롭: 낙하 20배 */
export const SOFT_DROP_FACTOR = 20;

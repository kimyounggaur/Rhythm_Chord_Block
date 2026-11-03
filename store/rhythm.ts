// 리듬 모드 상태(Zustand)
//  · useRhythmSave: 저장 데이터(§15 SaveData) — 최고 점수·클리어한 스테이지·도감·설정. localStorage 에 바로 쓴다(새로고침 뒤에도 유지).
//  · useRhythmView: 게임 화면이 읽는 스냅숏. 엔진(lib/rhythm/engine.ts)은 ref 에 두고, 보이는 것이 바뀔 때만 여기 넣는다
//    (보드는 잠금·지우기 때만, 조각은 움직일 때만) — 매 프레임 전체를 다시 그리지 않는다(§16-3).
'use client';
import { create } from 'zustand';
import { loadSave, SAVE_KEYS, writeSave } from '@/lib/music/storage';
import type { ClearEvent } from '@/lib/rhythm/engine';
import { getMeter } from '@/lib/rhythm/meters';
import type { ActivePiece, Board, MeasureResult, Meter, MeterId, Phase, PieceType, SaveData, Settings } from '@/lib/rhythm/types';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  metronome: true,
  volume: 0.8,
  controls: 'both',
  ghostPreview: null,
  strictNotation: false,
  showCcwButton: false,
};

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  highScores: {},
  clearedStages: [],
  patterns: {},
  settings: DEFAULT_SETTINGS,
  stageBest: {},
};

export interface GameRecord {
  mode: 'campaign' | 'endless';
  meterId: MeterId;
  stageId: number | null;
  score: number;
  cleared: boolean;
}

interface SaveState {
  data: SaveData;
  reload: () => void;
  updateSettings: (p: Partial<Settings>) => void;
  /** 엔진의 도감 횟수를 저장본에 합친다(키마다 큰 값) */
  mergePatterns: (counts: Readonly<Record<string, number>>) => void;
  /** 판이 끝났을 때. 최고 점수면 newHigh */
  recordGame: (r: GameRecord) => { newHigh: boolean; firstClear: boolean };
  replace: (d: SaveData) => void;
}

function persist(d: SaveData) {
  writeSave(SAVE_KEYS.rhythm, d);
}

export const useRhythmSave = create<SaveState>((set, get) => ({
  data: loadSave(SAVE_KEYS.rhythm, DEFAULT_SAVE),
  reload: () => set({ data: loadSave(SAVE_KEYS.rhythm, DEFAULT_SAVE) }),
  updateSettings: (p) => {
    const d = { ...get().data, settings: { ...get().data.settings, ...p } };
    persist(d);
    set({ data: d });
  },
  mergePatterns: (counts) => {
    const cur = get().data;
    let changed = false;
    const patterns = { ...cur.patterns };
    for (const [k, v] of Object.entries(counts)) {
      if ((patterns[k] ?? 0) < v) {
        patterns[k] = v;
        changed = true;
      }
    }
    if (!changed) return;
    const d = { ...cur, patterns };
    persist(d);
    set({ data: d });
  },
  recordGame: (r) => {
    const cur = get().data;
    const key = `${r.mode}:${r.meterId}`;
    const newHigh = r.score > (cur.highScores[key] ?? 0);
    const highScores = newHigh ? { ...cur.highScores, [key]: r.score } : cur.highScores;
    let clearedStages = cur.clearedStages;
    let stageBest = cur.stageBest;
    let firstClear = false;
    if (r.stageId !== null) {
      if (r.cleared && !clearedStages.includes(r.stageId)) {
        clearedStages = [...clearedStages, r.stageId].sort((a, b) => a - b);
        firstClear = true;
      }
      const sk = String(r.stageId);
      if (r.score > (stageBest[sk] ?? 0)) stageBest = { ...stageBest, [sk]: r.score };
    }
    const d = { ...cur, highScores, clearedStages, stageBest };
    persist(d);
    set({ data: d });
    return { newHigh, firstClear };
  },
  replace: (d) => {
    persist(d);
    set({ data: d });
  },
}));

/** 스테이지가 열렸는가: 1번은 늘, 나머지는 앞 스테이지를 깼을 때 */
export function isStageUnlocked(d: SaveData, id: number): boolean {
  return id === 1 || d.clearedStages.includes(id - 1) || d.clearedStages.includes(id);
}

// ─────────────────────────── 게임 화면 스냅숏 ───────────────────────────

export interface PanelMeasure {
  id: number;
  result: MeasureResult;
}

export interface ViewState {
  meter: Meter;
  board: Board;
  active: ActivePiece | null;
  ghostY: number;
  hold: PieceType | null;
  holdUsed: boolean;
  next: PieceType[];
  score: number;
  level: number;
  bpm: number;
  measures: number;
  combo: number;
  phase: Phase;
  /** 지우는 중인 마디(연출) */
  clearing: ClearEvent | null;
  /** 악보 패널에 보이는 마디 */
  panel: PanelMeasure | null;
  /** 재생 헤드(연주 중인 마디 id 와 칸) */
  playhead: { id: number; cell: number } | null;
  /** 메트로놈 박 표시 */
  beat: { cell: number; accent: boolean; n: number };
}

export const useRhythmView = create<ViewState>(() => ({
  meter: getMeter('4/4'),
  board: [],
  active: null,
  ghostY: 0,
  hold: null,
  holdUsed: false,
  next: [],
  score: 0,
  level: 1,
  bpm: 100,
  measures: 0,
  combo: -1,
  phase: 'idle',
  clearing: null,
  panel: null,
  playhead: null,
  beat: { cell: 0, accent: false, n: 0 },
}));

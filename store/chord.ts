'use client';
// 화음 모드 상태(Zustand) — 저장 데이터(SaveData §15: 최고 점수·클리어한 스테이지·진행 도감·푼 퍼즐·설정)와 화면 이동.
// 한 판 진행 상태는 엔진(lib/chord/engine.ts)이 갖고, 여기에는 판 밖의 것만 둔다.
import { create } from 'zustand';
import { SAVE_KEYS, loadSave, writeSave } from '@/lib/music/storage';
import { setMasterVolume, setMuted } from '@/lib/music/audio';
import { DEFAULT_SAVE, highScoreKey } from '@/lib/chord/save';
import type { GameMode, SaveData, Settings } from '@/lib/chord/types';

export type Screen = 'menu' | 'stages' | 'puzzles' | 'collection' | 'settings' | 'game';

export interface Session {
  mode: GameMode;
  stageId: number;
  puzzleId?: string;
  /** 같은 판을 다시 할 때도 새 엔진을 만들도록 */
  nonce: number;
}

interface ChordStore {
  save: SaveData;
  loaded: boolean;
  screen: Screen;
  /** 스테이지 고르기 화면의 탭 */
  stageTab: 'campaign' | 'endless';
  /** 설정 화면에서 돌아갈 곳 */
  back: Screen;
  session: Session | null;
  init: () => void;
  go: (s: Screen) => void;
  openStages: (tab: 'campaign' | 'endless') => void;
  openSettings: () => void;
  startGame: (mode: GameMode, stageId: number, puzzleId?: string) => void;
  restart: () => void;
  quitGame: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** 한 판이 끝났을 때(클리어·게임 오버·퍼즐 성공) */
  recordGame: (r: { mode: GameMode; stageId: number; puzzleId?: string; score: number; cleared: boolean }) => void;
  /** 도감 달성 횟수(엔진이 센 값으로 덮어쓴다) */
  setCollections: (c: Record<string, number>) => void;
  resetProgress: () => void;
}

function persist(save: SaveData) {
  writeSave(SAVE_KEYS.chord, save);
}

function applyAudio(s: Settings) {
  setMuted(!s.sound);
  setMasterVolume(s.volume);
}

let nonce = 0;

export const useChordStore = create<ChordStore>((set, get) => ({
  save: DEFAULT_SAVE,
  loaded: false,
  screen: 'menu',
  stageTab: 'campaign',
  back: 'menu',
  session: null,

  init: () => {
    if (get().loaded) return;
    const save = loadSave<SaveData>(SAVE_KEYS.chord, DEFAULT_SAVE);
    applyAudio(save.settings);
    set({ save, loaded: true });
  },

  go: (screen) => set({ screen }),
  openStages: (tab) => set({ screen: 'stages', stageTab: tab }),
  openSettings: () => set({ back: get().screen === 'settings' ? get().back : get().screen, screen: 'settings' }),

  startGame: (mode, stageId, puzzleId) => set({ session: { mode, stageId, puzzleId, nonce: ++nonce }, screen: 'game' }),
  restart: () => {
    const s = get().session;
    if (s) set({ session: { ...s, nonce: ++nonce } });
  },
  quitGame: () => {
    const s = get().session;
    set({ screen: s?.mode === 'puzzle' ? 'puzzles' : s ? 'stages' : 'menu', stageTab: s?.mode === 'endless' ? 'endless' : 'campaign' });
  },

  updateSettings: (patch) => {
    const save = { ...get().save, settings: { ...get().save.settings, ...patch } };
    applyAudio(save.settings);
    persist(save);
    set({ save });
  },

  recordGame: ({ mode, stageId, puzzleId, score, cleared }) => {
    const prev = get().save;
    const save: SaveData = { ...prev, highScores: { ...prev.highScores } };
    if (mode !== 'puzzle') {
      const key = highScoreKey(mode, stageId);
      save.highScores[key] = Math.max(save.highScores[key] ?? 0, score);
    }
    if (mode === 'campaign' && cleared && !prev.clearedStages.includes(stageId)) save.clearedStages = [...prev.clearedStages, stageId].sort((a, b) => a - b);
    if (mode === 'puzzle' && cleared && puzzleId && !prev.puzzlesSolved.includes(puzzleId)) save.puzzlesSolved = [...prev.puzzlesSolved, puzzleId];
    persist(save);
    set({ save });
  },

  setCollections: (c) => {
    const save = { ...get().save, collections: { ...get().save.collections, ...c } };
    persist(save);
    set({ save });
  },

  resetProgress: () => {
    const save: SaveData = { ...structuredClone(DEFAULT_SAVE), settings: get().save.settings };
    persist(save);
    set({ save });
  },
}));

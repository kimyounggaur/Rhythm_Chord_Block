// 리듬 모드 데이터 모델 — 설계서 §15 그대로. (설계서에 없는 필드는 '확장'이라고 적었다)
// 순수 타입·상수만 둔다(화면·소리 코드 없음).
import type { Solfege } from '@/lib/music/solfege';

export type { Solfege };

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type MeterId = '4/4' | '3/4' | '6/8' | '9/8' | '12/8' | '5/4' | '7/8';

export const PIECE_TYPES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export const METER_IDS: readonly MeterId[] = ['4/4', '3/4', '6/8', '9/8', '12/8', '5/4', '7/8'];

/** 조각 종류 = 계이름 (§4.3) */
export const PITCH_MAP: Record<PieceType, Solfege> = { I: '도', O: '레', T: '미', S: '파', Z: '솔', J: '라', L: '시' };
/** VexFlow 음 이름 (§4.3, 옥타브 4) */
export const VEX_KEY: Record<Solfege, string> = { 도: 'c/4', 레: 'd/4', 미: 'e/4', 파: 'f/4', 솔: 'g/4', 라: 'a/4', 시: 'b/4' };

export interface Meter {
  id: MeterId;
  beats: number;
  beatUnit: 4 | 8;
  width: number; // 8분음표 칸 수
  beatStarts: number[]; // 박 시작 칸
  strength: number[]; // 칸별 세기 0~3
  beamGroups: number[]; // 기 묶음 칸 수
  notationGroups: number[]; // 표기 묶음(가상 세로줄) 칸 수
}

export interface Cell {
  pieceId: number;
  type: PieceType;
}
export type Board = (Cell | null)[][]; // board[y][x], y=0 맨 위

export type Rotation = 0 | 1 | 2 | 3;
export interface ActivePiece {
  id: number;
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export interface Rules {
  pitchSound: boolean; // false면 박수 소리(스테이지 1)
  showSolfege: boolean;
  syncopationBonus: boolean;
  chordBonus: boolean;
  ties: boolean;
  strictNotation: boolean;
  beatColoring: boolean;
  /** 확장: 패턴 도감(점수·등록). 없으면 켬. 스테이지 1만 끔 — §12 "스테이지 2: 도감 열림" */
  patternBonus?: boolean;
}

export interface NoteEvent {
  pitch: Solfege;
  start: number;
  length: number;
  syncopated: boolean;
  tied: boolean;
  pieceIds: number[];
}
export type Duration = '8' | 'q' | 'qd' | 'h' | 'hd' | 'w'; // VexFlow 표기
export interface NotationNote {
  pitch: Solfege;
  start: number;
  duration: Duration;
  tieToNext: boolean;
  syncopated: boolean;
}

/** 확장: 떠오르는 글자 색을 고르려고 kind 를 붙인다 */
export type ScoreKind = 'measure' | 'lines' | 'sync' | 'chord' | 'pattern' | 'patternNew' | 'tie' | 'combo' | 'perfect' | 'drop';
export interface ScoreItem {
  label: string;
  points: number;
  kind?: ScoreKind;
}
export interface MeasureResult {
  complete: boolean;
  y: number;
  meterId: MeterId;
  notes: NoteEvent[];
  notation: NotationNote[];
  syncopationCount: number;
  chord: 'I' | 'IV' | 'V' | null;
  patternId: string | null;
  score: number;
  breakdown: ScoreItem[];
}

export interface StageConfig {
  id: number;
  name: string;
  meterId: MeterId;
  rules: Rules;
  targetMeasures: number;
  startLevel: number;
  card: { text: string; image: string };
  /** 확장(스테이지 10): 목표의 절반에서 박자표를 바꾼다(보드를 비우고 카드를 보여 준다) */
  meterSwitch?: { at: number; meterId: MeterId; text: string };
}

export interface RunStats {
  measures: number;
  notesByDuration: Record<Duration, number>;
  syncopations: number;
  chordMeasures: number;
  maxCombo: number;
  newPatterns: string[]; // `${meterId}:${patternId}`
  bestMeasure: MeasureResult | null;
}

export type Phase = 'idle' | 'spawn' | 'falling' | 'locking' | 'clearing' | 'paused' | 'stageClear' | 'gameover';

export interface GameState {
  phase: Phase;
  mode: 'campaign' | 'endless';
  stage: StageConfig;
  meter: Meter;
  board: Board;
  active: ActivePiece | null;
  ghostY: number;
  hold: PieceType | null;
  holdUsed: boolean;
  queue: PieceType[];
  bag: PieceType[];
  nextPieceId: number;
  level: number;
  bpm: number;
  dropIntervalMs: number;
  score: number;
  measuresCleared: number;
  combo: number;
  playbackQueue: MeasureResult[];
  stats: RunStats;
}

export interface Settings {
  sound: boolean;
  metronome: boolean;
  volume: number;
  controls: 'buttons' | 'gestures' | 'both';
  /** §14-3 "스테이지 1~3 기본 켬, 설정 가능" — null 이면 자동(스테이지 1~3만 켬), true/false 는 사용자가 고른 값 (확장: null) */
  ghostPreview: boolean | null;
  strictNotation: boolean;
  /** 확장: ⟲(반시계) 버튼 보이기 — §5.1 "⟲ (설정으로 표시)" */
  showCcwButton: boolean;
}

export interface SaveData {
  version: 1;
  highScores: Record<string, number>; // key: `${mode}:${meterId}`
  clearedStages: number[];
  patterns: Record<string, number>; // key: `${meterId}:${patternId}` → 달성 횟수
  settings: Settings;
  /** 확장: 스테이지별 최고 점수(스테이지 고르기 화면에 표시) */
  stageBest: Record<string, number>;
}

export const BOARD_ROWS = 18;
export const HIDDEN_ROWS = 2;
export const VISIBLE_ROWS = 16;

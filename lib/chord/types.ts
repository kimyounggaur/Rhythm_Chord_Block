// 화음 모드 데이터 모델 — 설계서 §15 를 그대로 옮기고, 확장(§17 M10)에 필요한 것만 더했다.
//   확장: 가단조(스테이지 10)의 8번째 타일 '솔♯' 과 화음 ⅰ·ⅳ·Ⅴ(가단조 = 'Va'), 연출용 필드 몇 개.
// 순수 로직(lib/chord/*)은 화면·소리와 섞지 않는다(설계서 §16 주의 2).
import type { Solfege } from '@/lib/music/solfege';

/** 타일 하나의 음. 설계서 §15 의 Solfege 에 가단조 확장용 '솔♯' 을 더했다. */
export type Pitch = Solfege | '솔♯';

/** 'Va' = 가단조의 Ⅴ(미·솔♯·시). 화면에는 Ⅴ 로 보인다. */
export type ChordId = 'I' | 'IV' | 'V' | 'V7' | 'i' | 'iv' | 'Va';
export type TileKind = 'note' | 'garbage';

/** 칸 좌표 [x, y] — x=0 왼쪽, y=0 숨김 줄, y=14 바닥 (§4.1) */
export type Cell = [number, number];

export interface Chord {
  id: ChordId;
  name: string;
  tones: Pitch[];
  root: Pitch;
  /** Ⅴ7: 이 음이 모두 있어야 Ⅴ7 로 터진다. 없으면 tones 전체 */
  requiredTones?: Pitch[];
  /** Ⅴ7: requiredTones 가 모자라도 이 화음의 구성음이 다 있으면 이 화음으로 터진다(T13) */
  fallback?: ChordId;
  key: 'C' | 'a';
  /** 화성 기능 — 진행 보너스 표에 정확한 짝이 없을 때 쓰는 이름(Ⅴ7·Va → V, ⅰ → I, ⅳ → IV) */
  fn: 'I' | 'IV' | 'V';
  roman: string;
  /** 대표 화음 동점 순서(작을수록 앞): Ⅰ > Ⅴ7 > Ⅴ > Ⅳ (§8) */
  rank: number;
  color: string;
  art: { halo: 'i' | 'iv' | 'v' | 'v7'; badge: string; chip: string | null; burst: 'i' | 'iv' | 'v'; hint: 'i' | 'iv' | 'v' };
}

export interface Tile {
  id: number;
  kind: TileKind;
  pitch: Pitch | null; // garbage 는 null
}
/** board[y][x], y=0 숨김, y=14 바닥, 폭 7 */
export type Board = (Tile | null)[][];

export type Dir = 0 | 1 | 2 | 3; // 위성 방향: 위·오른쪽·아래·왼쪽

export interface Pair {
  axis: Pitch;
  satellite: Pitch;
  x: number; // 축 타일 좌표
  y: number;
  dir: Dir;
}

/** 떨어지는 중인 조각 — 두 타일의 id 를 함께 들고 있다(착지 뒤에도 같은 id 라 화면이 끊기지 않는다) */
export interface ActivePair extends Pair {
  axisId: number;
  satId: number;
}

export interface GarbageRules {
  enabled: boolean;
  intervalSec: number;
  base: number;
  max: number;
}

export interface Rules {
  minGroup: number; // 기본 4
  activeChords: ChordId[];
  weights: Partial<Record<Pitch, number>>; // 생성 가중치
  pairAffinity: number; // 0~1
  hints: boolean;
  intervalLabel: boolean;
  garbage: GarbageRules;
  tensionPad: boolean;
}

export interface PopEvent {
  chord: ChordId;
  cells: Cell[];
  size: number;
  toneCounts: Partial<Record<Pitch, number>>;
}

export interface PopResult {
  events: PopEvent[];
  removedCells: Cell[];
  /** 터진 계이름 타일 수(이벤트 칸의 합집합). 함께 사라지는 비화음·비활성 타일은 세지 않는다(§7-4) */
  poppedCount: number;
  /** 두 이벤트가 함께 가진 칸 수(공통음) */
  sharedCount: number;
  sharedCells: Cell[];
  /** 터진 덩어리에 맞닿아 함께 사라지는 비화음·비활성 화음 타일 */
  junkCells: Cell[];
}

export interface ScoreItem {
  label: string;
  points: number;
}

export interface ChainStep {
  index: number; // 1부터
  events: PopEvent[];
  mainChord: ChordId;
  poppedCount: number;
  chainPower: number;
  groupBonus: number;
  simulBonus: number;
  /** 진행 보너스 = 짝 보너스(§8 표) + 완성 보너스 */
  progressionBonus: number;
  progressionName: string | null; // '정격마침' 등
  score: number;
  breakdown: ScoreItem[];
  // ── 연출·통계용 확장
  pairBonus: number;
  pairFrom: ChordId | null;
  pairTo: ChordId | null;
  pairText: string | null;
  reverseHint: string | null;
  sequences: { name: string; bonus: number; sequence: ChordId[] }[];
  sharedCount: number;
  simulLabel: string | null;
  removedCount: number;
}

export interface ChainResult {
  steps: ChainStep[];
  chain: number;
  progression: ChordId[];
  /** 단계 점수의 합(§10 공식). 전체 지우기(+2000)·도감(+500/+100)은 게임이 따로 더한다(T1·T6·T7 합계가 이 값) */
  totalScore: number;
  allClear: boolean;
  /** 대표 진행 도감 id(없으면 공통음·6성부 중 첫 번째) */
  collectionId: string | null;
}

export type GoalType = 'pops' | 'chordPops' | 'cadence' | 'progression' | 'shared' | 'survive' | 'score';
export interface Goal {
  type: GoalType;
  chord?: ChordId;
  progression?: ChordId[];
  count: number;
}

export interface StageConfig {
  id: number;
  name: string;
  rules: Rules;
  /** 부록 B 형식. 스테이지 2·3·5·10 처럼 목표가 여럿이면 배열(모두 채워야 클리어) */
  goal: Goal | Goal[];
  startLevel: number;
  card: { text: string; image: string };
}

export interface RunStats {
  pieces: number;
  popsByChord: Partial<Record<ChordId, number>>;
  maxChain: number;
  cadences: Record<string, number>;
  sharedPops: number;
  maxGroup: number;
  newCollections: string[];
  bestChain: ChainResult | null;
  // 확장
  chains: number;
  allClears: number;
  reverseCount: number;
}

export type GamePhase = 'idle' | 'spawn' | 'falling' | 'splitting' | 'resolving' | 'paused' | 'stageClear' | 'gameover';
export type GameMode = 'campaign' | 'endless' | 'puzzle';

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  stage: StageConfig;
  board: Board;
  pair: Pair | null;
  queue: [Pitch, Pitch][];
  level: number;
  dropIntervalMs: number;
  score: number;
  pieces: number;
  pendingGarbage: number;
  stats: RunStats;
  nextTileId: number;
}

/** 'auto' = 스테이지 기본값을 따른다(힌트: 1~6 켬, 7~ 끔 / 음정: 3~ 켬). 설계서 §15 의 boolean 에 'auto' 를 더했다 */
export type AutoBool = boolean | 'auto';

export interface Settings {
  sound: boolean;
  tensionPad: boolean;
  volume: number;
  controls: 'buttons' | 'gestures' | 'both';
  hints: AutoBool;
  intervalLabel: AutoBool;
  /** 선생님용: 모든 스테이지·퍼즐 열기(확장) */
  unlockAll: boolean;
}

export interface SaveData {
  version: 1;
  highScores: Record<string, number>;
  clearedStages: number[];
  collections: Record<string, number>;
  puzzlesSolved: string[];
  settings: Settings;
}

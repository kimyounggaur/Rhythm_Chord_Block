// 게임 진행 엔진(순수 로직, 화면·소리 없음) — 설계서 §6 상태 흐름
//   시작 → 등장 → 낙하/조작 → 한쪽 착지 → 분리 낙하 → 둘 다 착지 → 해결 루프(중력 → 터짐 → …) → 게임 오버 확인 → 등장
//   해결 루프 동안 조작 입력은 무시한다(일시정지만 허용). 화면은 getView() 를, 소리는 이벤트(drainEvents)를 본다.
// 시간은 update(dtMs) 로만 흐른다(테스트에서 10분을 몇 초에 돌릴 수 있다). 타이머·setInterval 없음.
import { COLS, ROWS, SPAWN_X, SPAWN_Y, cloneBoard, emptyBoard, isSettled, maxColumnHeight, maxTileId } from './board';
import { TIMING, buildTimeline, fallMs, resolve, type ResolveResult, type Timeline, type TimelinePhase } from './chain';
import { collectionBonus } from './collection';
import { SCORE_TABLE, goalsOf, puzzleRules, type PuzzleDef } from './defs';
import { dropGarbage, garbageCount } from './garbage';
import { allGoalsDone, initGoals, updateGoals, type GoalProgress } from './goals';
import { parseGrid } from './grid';
import { dropDistance, lockPair, pairTiles, spawnPair, tryFlip, tryMove, tryRotate } from './pair';
import { seqContains } from './progression';
import { Rng, drawPair } from './spawn';
import { addChain, emptyStats } from './stats';
import type {
  ActivePair,
  Board,
  ChainStep,
  GameMode,
  GamePhase,
  GameState,
  Pitch,
  Rules,
  RunStats,
  ScoreItem,
  StageConfig,
  TileKind,
} from './types';

/** §6.2 속도표(낙하 간격, 1칸당 ms). 11레벨부터 −15/레벨, 최소 80 */
const SPEED = [1000, 850, 720, 600, 500, 420, 350, 300, 250, 200];
export function dropIntervalFor(level: number): number {
  if (level <= SPEED.length) return SPEED[Math.max(1, level) - 1];
  return Math.max(80, SPEED[SPEED.length - 1] - 15 * (level - SPEED.length));
}

export const LEVEL_EVERY = 25; // 조각 25개마다 레벨 업
export const SOFT_DROP_FACTOR = 20; // 소프트 드롭 = 간격 ÷ 20
export const HARD_DROP_GUARD_MS = 300; // 하드 드롭 뒤 300ms 동안 하드 드롭 무시(§5.1)
export const DOUBLE_ROTATE_MS = 300; // 1칸 틈에서 300ms 안에 두 번 → 180°(§5.3)
export const TENSION_HEIGHT = 10; // 어느 열이든 높이 10 이상이면 긴장(§9)
export const GARBAGE_APPEAR_MS = 60;

export interface EngineOptions {
  mode: GameMode;
  stage: StageConfig;
  puzzle?: PuzzleDef;
  seed?: number;
  /** 저장된 도감 달성 횟수(첫 달성 +500 / 재달성 +100 판단) */
  collections?: Record<string, number>;
}

export interface CollectionGain {
  id: string;
  first: boolean;
  points: number;
}

export type EngineEvent =
  | { type: 'spawn' }
  | { type: 'move' }
  | { type: 'rotate'; flip: boolean }
  | { type: 'rotateFail' }
  | { type: 'hardDrop'; cells: number }
  | { type: 'land'; pitches: (Pitch | null)[]; cells: [number, number][] }
  | { type: 'chain'; result: ResolveResult; timeline: Timeline }
  | { type: 'step'; step: ChainStep; phase: TimelinePhase; total: number }
  | { type: 'chainEnd'; result: ResolveResult; bonuses: ScoreItem[]; collections: CollectionGain[] }
  | { type: 'garbage'; count: number }
  | { type: 'levelUp'; level: number }
  | { type: 'tension'; tense: boolean }
  | { type: 'goals'; goals: GoalProgress[] }
  | { type: 'stageClear' }
  | { type: 'puzzleSolved' }
  | { type: 'gameOver'; reason: 'topOut' | 'puzzleFail' }
  | { type: 'pause'; paused: boolean };

export interface TileView {
  id: number;
  x: number;
  y: number;
  pitch: Pitch | null;
  kind: TileKind;
  layer: 'board' | 'pair';
  state: 'idle' | 'pop' | 'junk';
  /** 이 타일만 따로 쓰는 이동 시간(방금 하드 드롭으로 내려앉은 조각) */
  ms?: number;
}

export interface EngineView {
  tiles: TileView[];
  /** 보드 타일 이동 transition(ms) */
  fallMs: number;
  /** 떨어지는 조각 이동 transition(ms) */
  pairMs: number;
  /** 지금 내려오는 중인 타일(받침대를 잠깐 숨긴다) */
  movingIds: Set<number>;
  /** 받침대·힌트를 계산할 보드 */
  board: Board;
  /** 지금 터지는 단계(없으면 null) */
  popStep: ChainStep | null;
  phase: GamePhase;
}

type Anim =
  | { kind: 'split'; t: number; dur: number; movingIds: number[]; land: { pitch: Pitch | null; cell: [number, number] }[] }
  | { kind: 'chain'; t: number; result: ResolveResult; timeline: Timeline; idx: number }
  | { kind: 'garbage'; t: number; dur: number; fall: number; placed: { id: number; x: number; y: number }[] };

export class ChordEngine {
  readonly mode: GameMode;
  readonly stage: StageConfig;
  readonly rules: Rules;
  readonly puzzle: PuzzleDef | null;
  board: Board;
  pair: ActivePair | null = null;
  queue: [Pitch, Pitch][] = [];
  phase: GamePhase = 'idle';
  paused = false;
  level: number;
  pieces = 0;
  score = 0;
  stats: RunStats = emptyStats();
  goals: GoalProgress[];
  pendingGarbage = 0;
  garbageTimer = 0;
  nextTileId = 1;
  clock = 0;
  softDrop = false;
  tense = false;
  /** 화면이 다시 그려야 하면 오른다 */
  version = 0;
  lastChain: ResolveResult | null = null;
  collections: Record<string, number>;
  /** 소프트/하드 드롭으로 얻은 점수 합(요약·검사용) */
  dropPoints = 0;
  /** 점수 내역 합(검사용): 드롭 + 단계 점수 + 전체 지우기 + 도감 */
  ledger = { drops: 0, steps: 0, allClear: 0, collection: 0 };

  private rng: Rng;
  private gravityTimer = 0;
  private lastHardDrop = -1e9;
  private lastRotateFail = -1e9;
  private anim: Anim | null = null;
  private events: EngineEvent[] = [];
  private pairMoveMs = 70;
  private lockFx: { ids: number[]; ms: number; until: number } | null = null;

  constructor(opts: EngineOptions) {
    this.mode = opts.mode;
    this.puzzle = opts.puzzle ?? null;
    this.stage = opts.stage;
    this.rules = this.puzzle ? puzzleRules(this.puzzle) : opts.stage.rules;
    this.level = this.puzzle ? 1 : opts.stage.startLevel;
    this.rng = new Rng(opts.seed ?? (Date.now() ^ Math.floor(Math.random() * 1e9)));
    this.collections = { ...(opts.collections ?? {}) };
    this.goals = this.mode === 'campaign' ? initGoals(goalsOf(opts.stage)) : [];
    if (this.puzzle) {
      const g = parseGrid(this.puzzle.board, 1);
      this.board = g.board;
      this.nextTileId = g.nextId;
      this.queue = this.puzzle.pairs.map((p) => [p[0], p[1]] as [Pitch, Pitch]);
    } else {
      this.board = emptyBoard();
      while (this.queue.length < 3) this.queue.push(drawPair(this.rules, this.rng));
    }
  }

  // ───────────────────────── 정보

  get dropInterval(): number {
    return dropIntervalFor(this.level);
  }

  /** 다음 조각 2개(§4.4) */
  get nextPairs(): [Pitch, Pitch][] {
    return this.queue.slice(0, 2);
  }

  get canControl(): boolean {
    return this.phase === 'falling' && !this.paused && this.pair !== null;
  }

  /** §15 GameState 모양으로(테스트·디버그) */
  getState(): GameState {
    return {
      phase: this.paused ? 'paused' : this.phase,
      mode: this.mode,
      stage: this.stage,
      board: this.board,
      pair: this.pair,
      queue: this.queue,
      level: this.level,
      dropIntervalMs: this.dropInterval,
      score: this.score,
      pieces: this.pieces,
      pendingGarbage: this.pendingGarbage,
      stats: this.stats,
      nextTileId: this.nextTileId,
    };
  }

  drainEvents(): EngineEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ───────────────────────── 진행

  start() {
    if (this.phase !== 'idle') return;
    this.updateTension();
    this.spawnNext();
  }

  update(dt: number) {
    if (this.paused || this.phase === 'idle' || this.phase === 'stageClear' || this.phase === 'gameover') return;
    this.clock += dt;
    this.tickGarbageTimer(dt);
    if (this.phase === 'falling') this.tickFalling(dt);
    else if (this.phase === 'splitting') this.tickSplit(dt);
    else if (this.phase === 'resolving') this.tickResolve(dt);
  }

  pause() {
    if (this.paused || this.phase === 'gameover' || this.phase === 'stageClear' || this.phase === 'idle') return;
    this.paused = true;
    this.softDrop = false;
    this.emit({ type: 'pause', paused: true });
    this.bump();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.emit({ type: 'pause', paused: false });
    this.bump();
  }

  // ───────────────────────── 조작(§5)

  move(dx: -1 | 1): boolean {
    if (!this.canControl) return false;
    const p = tryMove(this.board, this.pair!, dx, 0);
    if (!p) return false;
    this.pair = p;
    this.pairMoveMs = 60;
    this.emit({ type: 'move' });
    this.bump();
    return true;
  }

  rotate(cw: boolean): boolean {
    if (!this.canControl) return false;
    const r = tryRotate(this.board, this.pair!, cw);
    if (r) {
      this.pair = r;
      this.lastRotateFail = -1e9;
      this.pairMoveMs = 70;
      this.emit({ type: 'rotate', flip: false });
      this.bump();
      return true;
    }
    if (this.clock - this.lastRotateFail <= DOUBLE_ROTATE_MS) {
      this.lastRotateFail = -1e9;
      const f = tryFlip(this.board, this.pair!);
      if (f) {
        this.pair = f;
        this.pairMoveMs = 70;
        this.emit({ type: 'rotate', flip: true });
        this.bump();
        return true;
      }
      return false;
    }
    this.lastRotateFail = this.clock;
    this.emit({ type: 'rotateFail' });
    return false;
  }

  setSoftDrop(on: boolean) {
    if (on === this.softDrop) return;
    this.softDrop = on;
    if (on) this.gravityTimer = Math.min(this.gravityTimer, this.baseInterval() / SOFT_DROP_FACTOR);
  }

  hardDrop(): boolean {
    if (!this.canControl) return false;
    if (this.clock - this.lastHardDrop < HARD_DROP_GUARD_MS) return false;
    this.lastHardDrop = this.clock;
    const d = dropDistance(this.board, this.pair!);
    this.pair = { ...this.pair!, y: this.pair!.y + d };
    this.addDropPoints(2 * d);
    this.pairMoveMs = Math.min(120, 25 * d);
    this.emit({ type: 'hardDrop', cells: d });
    this.lock();
    return true;
  }

  /** 대전 준비(M10): 상대 공격으로 방해 타일을 받는다 — 다음 등장 직전에 떨어진다 */
  receiveGarbage(n: number) {
    if (n > 0) this.pendingGarbage += n;
  }

  isDead(): boolean {
    return this.phase === 'gameover';
  }

  // ───────────────────────── 내부

  private emit(e: EngineEvent) {
    this.events.push(e);
  }

  private bump() {
    this.version++;
  }

  private baseInterval(): number {
    return this.mode === 'puzzle' ? 1000 : this.dropInterval;
  }

  private addDropPoints(n: number) {
    if (n <= 0) return;
    this.score += n;
    this.dropPoints += n;
    this.ledger.drops += n;
  }

  private tickGarbageTimer(dt: number) {
    const g = this.rules.garbage;
    if (!g.enabled || this.mode === 'puzzle') return;
    this.garbageTimer += dt;
    const every = g.intervalSec * 1000;
    while (this.garbageTimer >= every) {
      this.garbageTimer -= every;
      this.pendingGarbage += garbageCount(this.level, g);
    }
  }

  private tickFalling(dt: number) {
    if (!this.pair) return;
    if (this.mode === 'puzzle' && !this.softDrop) return; // 퍼즐: 저절로 내려가지 않는다(▼·⤓ 로 내려놓기)
    const interval = this.softDrop ? this.baseInterval() / SOFT_DROP_FACTOR : this.baseInterval();
    this.gravityTimer += dt;
    let guard = 0;
    while (this.gravityTimer >= interval && this.phase === 'falling' && guard++ < 40) {
      this.gravityTimer -= interval;
      this.stepDown(interval);
    }
  }

  private stepDown(interval: number) {
    const p = tryMove(this.board, this.pair!, 0, 1);
    if (p) {
      this.pair = p;
      this.pairMoveMs = Math.max(30, Math.min(90, interval * 0.9));
      if (this.softDrop) this.addDropPoints(1);
      this.bump();
      return;
    }
    this.lock();
  }

  private lock() {
    const p = this.pair!;
    this.pair = null;
    this.lockFx = { ids: [p.axisId, p.satId], ms: this.pairMoveMs, until: this.clock + this.pairMoveMs + 40 };
    this.board = cloneBoard(this.board); // 화면이 쥐고 있는 보드는 바꾸지 않는다(새 보드에 고정)
    const res = lockPair(this.board, p);
    this.pieces++;
    this.stats = { ...this.stats, pieces: this.pieces };
    if (!this.puzzle) {
      const lv = this.stage.startLevel + Math.floor(this.pieces / LEVEL_EVERY);
      if (lv !== this.level) {
        this.level = lv;
        this.emit({ type: 'levelUp', level: lv });
      }
    }
    const moving = new Set(res.splitMoves.map((m) => m.id));
    const fixed = res.landed.filter((t) => !moving.has(t.id));
    if (fixed.length) this.emit({ type: 'land', pitches: fixed.map((t) => t.pitch), cells: fixed.map((t) => [t.x, t.y]) });
    if (res.maxSplit > 0) {
      const dur = Math.min(TIMING.splitMax, TIMING.splitPerCell * res.maxSplit);
      const land = res.landed.filter((t) => moving.has(t.id)).map((t) => ({ pitch: t.pitch as Pitch | null, cell: [t.x, t.y] as [number, number] }));
      this.phase = 'splitting';
      this.anim = { kind: 'split', t: 0, dur, movingIds: [...moving], land };
      this.bump();
    } else {
      this.startResolve();
    }
  }

  private tickSplit(dt: number) {
    const a = this.anim;
    if (!a || a.kind !== 'split') return;
    a.t += dt;
    if (a.t >= a.dur) {
      this.emit({ type: 'land', pitches: a.land.map((l) => l.pitch), cells: a.land.map((l) => l.cell) });
      this.startResolve();
    }
  }

  private startResolve() {
    const result = resolve(this.board, this.rules);
    if (!result.chain) {
      this.board = result.board;
      this.anim = null;
      this.endTurn(null);
      return;
    }
    const timeline = buildTimeline(result.frames);
    this.phase = 'resolving';
    this.anim = { kind: 'chain', t: 0, result, timeline, idx: -1 };
    this.emit({ type: 'chain', result, timeline });
    this.advanceChain();
    this.bump();
  }

  private tickResolve(dt: number) {
    const a = this.anim;
    if (!a) return;
    a.t += dt;
    if (a.kind === 'chain') this.advanceChain();
    else if (a.kind === 'garbage') {
      if (a.t - dt < GARBAGE_APPEAR_MS && a.t >= GARBAGE_APPEAR_MS) this.bump();
      if (a.t >= a.dur) {
        this.anim = null;
        this.updateTension();
        this.spawnNext();
      }
    }
  }

  private advanceChain() {
    const a = this.anim;
    if (!a || a.kind !== 'chain') return;
    const ph = a.timeline.phases;
    while (a.idx + 1 < ph.length && a.t >= ph[a.idx + 1].start) {
      a.idx++;
      const cur = ph[a.idx];
      if (cur.kind === 'pop' && cur.frame.step) {
        this.score += cur.frame.step.score;
        this.ledger.steps += cur.frame.step.score;
        this.emit({ type: 'step', step: cur.frame.step, phase: cur, total: a.result.chain });
      }
      this.bump();
    }
    if (a.t >= a.timeline.total) this.finishChain(a.result);
  }

  private finishChain(r: ResolveResult) {
    this.board = r.board;
    this.anim = null;
    const bonuses: ScoreItem[] = [];
    if (r.allClear) {
      this.score += SCORE_TABLE.allClear;
      this.ledger.allClear += SCORE_TABLE.allClear;
      bonuses.push({ label: '전체 지우기', points: SCORE_TABLE.allClear });
    }
    const gains: CollectionGain[] = r.collectionIds.map((id) => {
      const prev = this.collections[id] ?? 0;
      const points = collectionBonus(prev);
      this.collections[id] = prev + 1;
      this.score += points;
      this.ledger.collection += points;
      return { id, first: prev === 0, points };
    });
    for (const g of gains) bonuses.push({ label: g.first ? '새 진행 도감' : '진행 도감', points: g.points });
    this.stats = addChain(this.stats, r, gains.filter((g) => g.first).map((g) => g.id));
    this.lastChain = r;
    this.emit({ type: 'chainEnd', result: r, bonuses, collections: gains });
    this.endTurn(r);
  }

  private endTurn(r: ResolveResult | null) {
    this.updateTension();
    if (this.goals.length) {
      const before = JSON.stringify(this.goals.map((g) => g.value));
      this.goals = updateGoals(this.goals, r, { pieces: this.pieces, score: this.score });
      if (JSON.stringify(this.goals.map((g) => g.value)) !== before) this.emit({ type: 'goals', goals: this.goals });
    }
    if (this.mode === 'campaign' && allGoalsDone(this.goals)) {
      this.phase = 'stageClear';
      this.emit({ type: 'stageClear' });
      this.bump();
      return;
    }
    if (this.puzzle && r && this.puzzleGoalMet(r)) {
      this.phase = 'stageClear';
      this.emit({ type: 'puzzleSolved' });
      this.bump();
      return;
    }
    if (this.pendingGarbage > 0 && !this.puzzle) {
      this.startGarbage();
      return;
    }
    this.spawnNext();
  }

  puzzleGoalMet(r: ResolveResult): boolean {
    const g = this.puzzle?.goal;
    if (!g) return false;
    return r.chain >= g.chain && (!g.progression || seqContains(r.progression, g.progression));
  }

  private startGarbage() {
    const n = Math.min(this.pendingGarbage, Math.max(1, this.rules.garbage.max || 6));
    this.pendingGarbage -= n;
    this.board = cloneBoard(this.board);
    const drop = dropGarbage(this.board, n, this.rng, this.nextTileId);
    this.nextTileId = drop.nextId;
    const fall = fallMs(drop.maxDrop + 1);
    this.phase = 'resolving';
    this.anim = { kind: 'garbage', t: 0, dur: GARBAGE_APPEAR_MS + fall, fall, placed: drop.placed };
    this.emit({ type: 'garbage', count: drop.placed.length });
    this.bump();
  }

  private spawnNext() {
    // 게임 오버: 새 조각이 나올 때 (3,1)이 차 있으면(§4.1, T11)
    if (this.board[SPAWN_Y][SPAWN_X] || this.board[SPAWN_Y - 1][SPAWN_X]) {
      this.gameOver('topOut');
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      this.gameOver('puzzleFail');
      return;
    }
    if (!this.puzzle) while (this.queue.length < 2) this.queue.push(drawPair(this.rules, this.rng));
    this.pair = { ...spawnPair(next[0], next[1]), axisId: this.nextTileId++, satId: this.nextTileId++ };
    this.phase = 'falling';
    this.gravityTimer = 0;
    this.pairMoveMs = 0;
    this.emit({ type: 'spawn' });
    this.bump();
  }

  private gameOver(reason: 'topOut' | 'puzzleFail') {
    this.phase = 'gameover';
    this.pair = null;
    this.softDrop = false;
    this.emit({ type: 'gameOver', reason });
    this.bump();
  }

  private updateTension() {
    const t = maxColumnHeight(this.board) >= TENSION_HEIGHT;
    if (t !== this.tense) {
      this.tense = t;
      this.emit({ type: 'tension', tense: t });
    }
  }

  // ───────────────────────── 화면용

  getView(): EngineView {
    const a = this.anim;
    let board = this.board;
    let fall = 0;
    let movingIds = new Set<number>();
    let popStep: ChainStep | null = null;
    const popIds = new Set<number>();
    const junkIds = new Set<number>();
    const override = new Map<number, number>(); // id → 보여 줄 y
    if (a?.kind === 'split') {
      fall = a.dur;
      movingIds = new Set(a.movingIds);
    } else if (a?.kind === 'chain' && a.idx >= 0) {
      const ph = a.timeline.phases[a.idx];
      board = ph.frame.board;
      if (ph.kind === 'fall') {
        fall = ph.fallMs;
        movingIds = new Set((ph.frame.moves ?? []).map((m) => m.id));
      } else if (ph.frame.pops) {
        popStep = ph.frame.step ?? null;
        for (const e of ph.frame.pops.events) for (const [x, y] of e.cells) popIds.add(board[y][x]!.id);
        for (const [x, y] of ph.frame.pops.junkCells) junkIds.add(board[y][x]!.id);
      }
    } else if (a?.kind === 'garbage') {
      movingIds = new Set(a.placed.map((p) => p.id));
      if (a.t < GARBAGE_APPEAR_MS) for (const p of a.placed) override.set(p.id, -1);
      else fall = a.fall;
    }
    const lf = this.lockFx && this.clock <= this.lockFx.until ? this.lockFx : null;
    const tiles: TileView[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = board[y][x];
        if (!t) continue;
        tiles.push({
          id: t.id,
          x,
          y: override.get(t.id) ?? y,
          pitch: t.pitch,
          kind: t.kind,
          layer: 'board',
          state: popIds.has(t.id) ? 'pop' : junkIds.has(t.id) ? 'junk' : 'idle',
          ms: lf && lf.ids.includes(t.id) && !movingIds.has(t.id) ? lf.ms : undefined,
        });
      }
    }
    if (this.pair) {
      for (const t of pairTiles(this.pair)) tiles.push({ id: t.id, x: t.x, y: t.y, pitch: t.pitch, kind: 'note', layer: 'pair', state: 'idle' });
    }
    return { tiles, fallMs: fall, pairMs: this.pairMoveMs, movingIds, board, popStep, phase: this.paused ? 'paused' : this.phase };
  }

  // ───────────────────────── 디버그·테스트

  /** 격자로 보드를 바꾼다(떨어지는 조각은 다시 등장) */
  debugLoadGrid(rows: string[]) {
    const g = parseGrid(rows, this.nextTileId);
    this.board = g.board;
    this.nextTileId = Math.max(g.nextId, maxTileId(this.board) + 1);
    this.anim = null;
    if (this.phase === 'falling' && this.pair) {
      this.pair = { ...this.pair, x: SPAWN_X, y: SPAWN_Y, dir: 0 };
    }
    this.updateTension();
    this.bump();
  }

  debugSetQueue(pairs: [Pitch, Pitch][]) {
    this.queue = pairs.map((p) => [p[0], p[1]] as [Pitch, Pitch]);
    if (!this.puzzle) while (this.queue.length < 2) this.queue.push(drawPair(this.rules, this.rng));
    this.bump();
  }

  /** 떨어지는 조각을 치우고 지금 보드로 해결 루프를 돌린다(정착되지 않은 보드도 된다) */
  debugResolveNow() {
    if (this.phase !== 'falling') return;
    this.pair = null;
    this.startResolve();
  }

  debugSetPair(axis: Pitch, satellite: Pitch) {
    if (this.phase !== 'falling' || !this.pair) return;
    this.pair = { ...this.pair, axis, satellite };
    this.bump();
  }

  debugGameOver() {
    this.gameOver('topOut');
  }

  debugClear() {
    if (this.mode !== 'campaign') return;
    this.goals = this.goals.map((g) => ({ ...g, value: g.goal.count, done: true }));
    this.phase = 'stageClear';
    this.pair = null;
    this.emit({ type: 'stageClear' });
    this.bump();
  }

  /** 검사용: 공중에 뜬 타일이 없어야 하는 순간인가 */
  boardShouldBeSettled(): boolean {
    return this.phase === 'falling' && isSettled(this.board);
  }

  cloneBoard(): Board {
    return cloneBoard(this.board);
  }
}

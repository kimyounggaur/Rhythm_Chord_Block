// 게임 진행(§6.1) — 순수 상태 기계. 화면·소리와 분리되어 있고 시간은 update(dtMs) 로만 흐른다.
//
//   시작 → 등장 → 낙하 → 바닥 닿음 → 잠금 대기(500ms) → 잠금 → 마디 판정
//                  ↑                                              │
//                  └──────── 지울 줄 없음 ◄──────────────────────────┤
//                  └── 지울 줄 있음: 지우기 연출(300ms) + 연주 큐 등록 ◄─┘
//   게임 오버: 등장 위치가 막힘, 또는 조각 전체가 보이는 영역 위(y<2)에서 잠김
//
// 화면은 events(소리·연출 신호)와 s(GameState)를 읽는다. 대전(M10)용 공격 이벤트는 MeasureResult 하나로 통일한다(clear.results).
import { activeCells, collides, createBoard, dropDistance, entirelyHidden, fits, fullRows, isRowEmpty, placePiece, removeRows } from './board';
import { drawFromBag, seededRng, type Rng } from './bag';
import { analyzeRow } from './measure';
import { getMeter } from './meters';
import { patternKey } from './patterns';
import { scoreClear, SCORE, type PlacedItem } from './score';
import { dropIntervalMs, levelFor, SOFT_DROP_FACTOR, speedForLevel } from './speed';
import { kickTests, nextRotation, spawnX, type XY } from './srs';
import type { ActivePiece, Board, Cell, Duration, GameState, MeasureResult, Meter, Phase, PieceType, Rotation, Rules, RunStats, StageConfig } from './types';

export const LOCK_DELAY_MS = 500;
export const LOCK_RESET_MAX = 15;
export const CLEAR_ANIM_MS = 300;
export const HARD_DROP_GUARD_MS = 300;
export const NEXT_COUNT = 2;

export interface EngineConfig {
  mode: 'campaign' | 'endless';
  stage: StageConfig;
  /** 설정의 '표기 엄격'(스테이지 규칙과 OR) */
  strictNotation?: boolean;
  seed?: number;
  rng?: Rng;
  /** 도감(달성 횟수, 키 `${meterId}:${patternId}`). 엔진은 복사본을 쓴다 */
  patterns?: Record<string, number>;
}

/** 한 번의 잠금으로 생긴 마디 완성 */
export interface ClearEvent {
  id: number;
  /** 지운 줄 y (위→아래) */
  rows: number[];
  /** 줄마다의 판정(위→아래 = 연주 순서) */
  results: MeasureResult[];
  items: PlacedItem[];
  total: number;
  combo: number;
  perfect: boolean;
  newPatterns: string[];
  level: number;
  meter: Meter;
  /** 잠근 직후 보드(지우기 전) — 연출용 */
  board: Board;
}

export type GameOverReason = 'blockOut' | 'lockOut';

export type EngineEvent =
  | { type: 'spawn'; piece: ActivePiece }
  | { type: 'move' }
  | { type: 'rotate'; kick: number }
  | { type: 'hold'; held: PieceType }
  | { type: 'hardDrop'; cells: number }
  | { type: 'lock'; piece: ActivePiece; cells: XY[]; dropPoints: number }
  | { type: 'clear'; clear: ClearEvent }
  | { type: 'clearDone'; clearId: number }
  | { type: 'levelUp'; level: number; bpm: number }
  | { type: 'meterChange'; meter: Meter; text: string }
  | { type: 'stageClear' }
  | { type: 'gameOver'; reason: GameOverReason };

export function emptyStats(): RunStats {
  return {
    measures: 0,
    notesByDuration: { '8': 0, q: 0, qd: 0, h: 0, hd: 0, w: 0 },
    syncopations: 0,
    chordMeasures: 0,
    maxCombo: 0,
    newPatterns: [],
    bestMeasure: null,
  };
}

export class RhythmEngine {
  readonly s: GameState;
  rules: Rules;
  events: EngineEvent[] = [];
  /** 화면이 다시 읽어야 할 부분(화면이 읽은 뒤 false 로) */
  dirty = { board: true, piece: true, hud: true };
  /** 디버그: 중력 멈춤(스크린샷용) */
  gravityFrozen = false;

  private rng: Rng;
  private patterns: Record<string, number>;
  private clock = 0;
  private fallAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lowestY = -1;
  private softDropping = false;
  private lastHardDrop = -Infinity;
  private clearTimer = 0;
  private pendingClear: ClearEvent | null = null;
  private resumePhase: Phase = 'falling';
  private dropPoints = 0;
  private bufferedRotate: 0 | 1 | -1 = 0;
  private bufferedHold = false;
  private switched = false;
  private clearSeq = 0;
  /** 스테이지 시작부터 센 마디(레벨 계산용) */
  private levelBase: number;

  constructor(cfg: EngineConfig) {
    this.rng = cfg.rng ?? seededRng(cfg.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.patterns = { ...(cfg.patterns ?? {}) };
    const meter = getMeter(cfg.stage.meterId);
    this.rules = { ...cfg.stage.rules, strictNotation: cfg.stage.rules.strictNotation || !!cfg.strictNotation };
    this.levelBase = cfg.stage.startLevel;
    const sp = speedForLevel(cfg.stage.startLevel);
    this.s = {
      phase: 'idle',
      mode: cfg.mode,
      stage: cfg.stage,
      meter,
      board: createBoard(meter.width),
      active: null,
      ghostY: 0,
      hold: null,
      holdUsed: false,
      queue: [],
      bag: [],
      nextPieceId: 1,
      level: cfg.stage.startLevel,
      bpm: sp.bpm,
      dropIntervalMs: dropIntervalMs(cfg.stage.startLevel, meter.width),
      score: 0,
      measuresCleared: 0,
      combo: -1,
      playbackQueue: [], // 연주 큐는 소리 모듈(audio/rhythm.ts)이 가진다 — 연주 중/대기를 소리 쪽만 알기 때문
      stats: emptyStats(),
    };
  }

  // ───────────────────────── 읽기 ─────────────────────────

  get clockMs() {
    return this.clock;
  }

  /** 도감 달성 횟수(엔진 안의 복사본) */
  get patternCounts(): Readonly<Record<string, number>> {
    return this.patterns;
  }

  get isSoftDropping() {
    return this.softDropping;
  }

  get lockResetsUsed() {
    return this.lockResets;
  }

  get lockElapsedMs() {
    return this.lockTimer;
  }

  activeCells(): XY[] {
    return this.s.active ? activeCells(this.s.active) : [];
  }

  ghostCells(): XY[] {
    const p = this.s.active;
    if (!p) return [];
    return activeCells({ ...p, y: this.s.ghostY });
  }

  drainEvents(): EngineEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ───────────────────────── 진행 ─────────────────────────

  start() {
    if (this.s.phase !== 'idle') return;
    this.spawn();
  }

  /** 게임 루프(requestAnimationFrame 한 개)에서 매 프레임 부른다 */
  update(dtMs: number) {
    const ph = this.s.phase;
    if (ph === 'idle' || ph === 'paused' || ph === 'stageClear' || ph === 'gameover') return;
    const dt = Math.max(0, dtMs);
    this.clock += dt;
    if (ph === 'clearing') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.finishClear();
      return;
    }
    const p = this.s.active;
    if (!p || this.gravityFrozen) return;
    if (this.grounded()) {
      this.s.phase = 'locking';
      this.fallAcc = 0;
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY_MS) this.lock();
      return;
    }
    this.s.phase = 'falling';
    this.lockTimer = 0;
    this.fallAcc += dt;
    const interval = this.currentInterval();
    while (this.fallAcc >= interval && this.s.active) {
      this.fallAcc -= interval;
      this.stepDown(this.softDropping);
      if (this.grounded()) {
        this.fallAcc = 0;
        this.s.phase = 'locking';
        break;
      }
    }
  }

  pause() {
    const ph = this.s.phase;
    if (ph === 'falling' || ph === 'locking' || ph === 'clearing' || ph === 'spawn') {
      this.resumePhase = ph;
      this.s.phase = 'paused';
      this.softDropping = false;
      this.dirty.hud = true;
    }
  }

  resume() {
    if (this.s.phase !== 'paused') return;
    this.s.phase = this.resumePhase;
    this.dirty.hud = true;
  }

  get paused() {
    return this.s.phase === 'paused';
  }

  /** 설정에서 '표기 엄격'을 바꿨을 때(다음 마디부터) */
  setStrictNotation(on: boolean) {
    this.rules = { ...this.rules, strictNotation: this.s.stage.rules.strictNotation || on };
  }

  // ───────────────────────── 조작 ─────────────────────────

  private canControl(): boolean {
    return (this.s.phase === 'falling' || this.s.phase === 'locking') && this.s.active !== null;
  }

  move(dir: -1 | 1): boolean {
    if (!this.canControl()) return false;
    const p = this.s.active!;
    const np: ActivePiece = { ...p, x: p.x + dir };
    if (!fits(this.s.board, np)) return false;
    const was = this.grounded();
    this.s.active = np;
    this.afterShift(was);
    this.events.push({ type: 'move' });
    return true;
  }

  rotate(dir: 1 | -1): boolean {
    if (this.s.phase === 'clearing') {
      // 지우기 연출 중에도 입력은 받는다 — 다음 조각이 나오자마자 돌린다(§6.1)
      this.bufferedRotate = dir;
      return false;
    }
    if (!this.canControl()) return false;
    const p = this.s.active!;
    const to = nextRotation(p.rotation, dir);
    const tests = kickTests(p.type, p.rotation, to);
    for (let i = 0; i < tests.length; i++) {
      const [dx, dy] = tests[i];
      const np: ActivePiece = { ...p, rotation: to as Rotation, x: p.x + dx, y: p.y + dy };
      if (fits(this.s.board, np)) {
        const was = this.grounded();
        this.s.active = np;
        this.afterShift(was);
        this.events.push({ type: 'rotate', kick: i });
        return true;
      }
    }
    return false;
  }

  setSoftDrop(on: boolean) {
    if (on === this.softDropping) return;
    this.softDropping = on;
    // 켜는 순간 쌓여 있던 낙하 시간 때문에 여러 칸이 한꺼번에 내려가지 않게
    if (on) this.fallAcc = Math.min(this.fallAcc, this.currentInterval());
  }

  hardDrop(): boolean {
    if (!this.canControl()) return false;
    // 실수 방지: 하드 드롭 뒤 300ms 동안 하드 드롭 입력 무시(§5.1)
    if (this.clock - this.lastHardDrop < HARD_DROP_GUARD_MS) return false;
    const p = this.s.active!;
    const d = dropDistance(this.s.board, p);
    this.s.active = { ...p, y: p.y + d };
    const pts = d * SCORE.hardDropCell;
    this.s.score += pts;
    this.dropPoints += pts;
    this.lastHardDrop = this.clock;
    this.events.push({ type: 'hardDrop', cells: d });
    this.dirty.hud = true;
    this.lock();
    return true;
  }

  /** 보관(홀드): 조각당 1회 */
  hold(): boolean {
    if (this.s.phase === 'clearing') {
      this.bufferedHold = true;
      return false;
    }
    if (!this.canControl() || this.s.holdUsed) return false;
    const cur = this.s.active!.type;
    const held = this.s.hold;
    this.s.hold = cur;
    this.s.holdUsed = true;
    this.s.active = null;
    this.events.push({ type: 'hold', held: cur });
    this.dirty.hud = true;
    this.spawn(held ?? undefined, true);
    return true;
  }

  // ───────────────────────── 내부 ─────────────────────────

  private currentInterval(): number {
    return this.softDropping ? this.s.dropIntervalMs / SOFT_DROP_FACTOR : this.s.dropIntervalMs;
  }

  private grounded(): boolean {
    const p = this.s.active;
    return !!p && !fits(this.s.board, { ...p, y: p.y + 1 });
  }

  private updateGhost() {
    const p = this.s.active;
    this.s.ghostY = p ? p.y + dropDistance(this.s.board, p) : 0;
  }

  /** 더 낮은 줄에 처음 닿으면 잠금 대기 재설정 횟수를 되돌린다(SRS 가이드라인의 이동 재설정 방식) */
  private trackLowest() {
    const p = this.s.active;
    if (p && p.y > this.lowestY) {
      this.lowestY = p.y;
      this.lockResets = 0;
    }
  }

  /** 이동·회전 뒤: 잠금 대기는 다시 세되 최대 15회까지만(§6.1) */
  private afterShift(wasGrounded: boolean) {
    this.trackLowest();
    this.updateGhost();
    const g = this.grounded();
    if ((wasGrounded || g) && this.lockResets < LOCK_RESET_MAX) {
      this.lockTimer = 0;
      this.lockResets++;
    }
    if (!g) this.s.phase = 'falling';
    else this.s.phase = 'locking';
    this.dirty.piece = true;
  }

  private stepDown(soft: boolean) {
    const p = this.s.active!;
    this.s.active = { ...p, y: p.y + 1 };
    if (soft) {
      this.s.score += SCORE.softDropCell;
      this.dropPoints += SCORE.softDropCell;
      this.dirty.hud = true;
    }
    this.trackLowest();
    this.dirty.piece = true;
  }

  private takeNext(): PieceType {
    while (this.s.queue.length < NEXT_COUNT + 1) this.s.queue.push(drawFromBag(this.s.bag, this.rng));
    const t = this.s.queue.shift()!;
    return t;
  }

  private spawn(type?: PieceType, fromHold = false) {
    const t = type ?? this.takeNext();
    if (this.s.queue.length < NEXT_COUNT) while (this.s.queue.length < NEXT_COUNT) this.s.queue.push(drawFromBag(this.s.bag, this.rng));
    const p: ActivePiece = { id: this.s.nextPieceId++, type: t, rotation: 0, x: spawnX(t, this.s.meter.width), y: 0 };
    this.dirty.piece = true;
    this.dirty.hud = true;
    if (!fits(this.s.board, p)) {
      this.gameOver('blockOut');
      return;
    }
    // 등장 위치는 y=0~1(숨김 줄). 바로 한 줄 내려 보이는 영역에 걸치게 한다(가이드라인과 같음)
    if (fits(this.s.board, { ...p, y: p.y + 1 })) p.y += 1;
    this.s.active = p;
    if (!fromHold) this.s.holdUsed = false;
    this.fallAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = p.y;
    this.dropPoints = 0;
    this.updateGhost();
    this.s.phase = this.grounded() ? 'locking' : 'falling';
    this.events.push({ type: 'spawn', piece: { ...p } });
    // 지우기 연출 중에 받아 둔 입력(보관·회전)
    if (this.bufferedHold && !fromHold) {
      this.bufferedHold = false;
      this.bufferedRotate = 0;
      this.hold();
      return;
    }
    this.bufferedHold = false;
    if (this.bufferedRotate) {
      const d = this.bufferedRotate;
      this.bufferedRotate = 0;
      this.rotate(d);
    }
  }

  private lock() {
    const p = this.s.active;
    if (!p) return;
    const cells = activeCells(p);
    placePiece(this.s.board, p);
    this.s.active = null;
    this.events.push({ type: 'lock', piece: { ...p }, cells, dropPoints: this.dropPoints });
    this.dropPoints = 0;
    this.dirty.board = true;
    this.dirty.piece = true;
    this.dirty.hud = true;
    if (entirelyHidden(cells)) {
      this.gameOver('lockOut');
      return;
    }
    const rows = fullRows(this.s.board);
    if (rows.length === 0) {
      this.s.combo = -1;
      this.spawn();
      return;
    }
    this.startClear(rows);
  }

  private startClear(rows: number[]) {
    const meter = this.s.meter;
    const level = this.s.level;
    const results: MeasureResult[] = [];
    const newPatterns: string[] = [];
    const patternsOn = this.rules.patternBonus !== false;
    for (const y of rows) {
      const r = analyzeRow(this.s.board[y], meter, this.rules, {
        y,
        level,
        isCollected: (k) => (this.patterns[k] ?? 0) > 0,
      });
      if (r.patternId && patternsOn) {
        const k = patternKey(meter.id, r.patternId);
        if ((this.patterns[k] ?? 0) === 0) newPatterns.push(k);
        this.patterns[k] = (this.patterns[k] ?? 0) + 1;
      }
      results.push(r);
    }
    this.s.combo += 1; // 첫 완성 = 0, 연속 두 번째부터 1, 2, …
    const set = new Set(rows);
    const perfect = this.s.board.every((row, y) => set.has(y) || isRowEmpty(row));
    const sc = scoreClear(results, level, this.s.combo, perfect);
    this.s.score += sc.total;
    this.s.measuresCleared += rows.length;

    const st = this.s.stats;
    st.measures += rows.length;
    for (const r of results) {
      for (const n of r.notation) st.notesByDuration[n.duration as Duration] += 1;
      if (this.rules.syncopationBonus) st.syncopations += r.syncopationCount;
      if (r.chord) st.chordMeasures += 1;
      if (!st.bestMeasure || r.score > st.bestMeasure.score) st.bestMeasure = r;
    }
    st.maxCombo = Math.max(st.maxCombo, this.s.combo);
    st.newPatterns.push(...newPatterns);

    const clear: ClearEvent = {
      id: ++this.clearSeq,
      rows,
      results,
      items: sc.items,
      total: sc.total,
      combo: this.s.combo,
      perfect,
      newPatterns,
      level,
      meter,
      board: this.s.board.map((r) => r.slice()),
    };
    this.pendingClear = clear;
    this.s.phase = 'clearing';
    this.clearTimer = CLEAR_ANIM_MS;
    this.events.push({ type: 'clear', clear });
    this.dirty.hud = true;
  }

  private finishClear() {
    const c = this.pendingClear;
    this.pendingClear = null;
    if (c) this.s.board = removeRows(this.s.board, c.rows);
    this.dirty.board = true;
    this.dirty.hud = true;
    const lv = levelFor(this.levelBase, this.s.measuresCleared);
    if (lv !== this.s.level) {
      this.setLevel(lv);
      this.events.push({ type: 'levelUp', level: lv, bpm: this.s.bpm });
    }
    if (c) this.events.push({ type: 'clearDone', clearId: c.id });
    const st = this.s.stage;
    if (this.s.mode === 'campaign' && st.targetMeasures > 0 && this.s.measuresCleared >= st.targetMeasures) {
      this.s.phase = 'stageClear';
      this.s.active = null;
      this.events.push({ type: 'stageClear' });
      return;
    }
    if (st.meterSwitch && !this.switched && this.s.measuresCleared >= st.meterSwitch.at) {
      this.switchMeter(st.meterSwitch.meterId, st.meterSwitch.text);
    }
    this.spawn();
  }

  private setLevel(level: number) {
    this.s.level = level;
    const sp = speedForLevel(level);
    this.s.bpm = sp.bpm;
    this.s.dropIntervalMs = dropIntervalMs(level, this.s.meter.width);
    this.dirty.hud = true;
  }

  /** 박자표가 바뀌면 보드 폭이 바뀌므로 보드를 비운다(§12) */
  private switchMeter(meterId: Meter['id'], text: string) {
    const m = getMeter(meterId);
    this.switched = true;
    this.s.meter = m;
    this.s.board = createBoard(m.width);
    this.s.dropIntervalMs = dropIntervalMs(this.s.level, m.width);
    this.dirty.board = true;
    this.dirty.hud = true;
    this.events.push({ type: 'meterChange', meter: m, text });
  }

  private gameOver(reason: GameOverReason) {
    this.s.phase = 'gameover';
    this.s.active = null;
    this.dirty.piece = true;
    this.dirty.hud = true;
    this.events.push({ type: 'gameOver', reason });
  }

  // ───────────────────────── 디버그(스크린샷·테스트) ─────────────────────────

  /** 아래쪽부터 줄을 채운다. rows[0] 이 가장 위 줄 */
  debugLoadRows(rows: (Cell | null)[][]) {
    const h = this.s.board.length;
    const w = this.s.meter.width;
    const b = createBoard(w, h);
    rows.forEach((r, i) => {
      const y = h - rows.length + i;
      for (let x = 0; x < w; x++) b[y][x] = r[x] ?? null;
    });
    this.s.board = b;
    this.updateGhost();
    if (this.s.active && collides(b, activeCells(this.s.active))) this.s.active = null;
    this.dirty.board = true;
    this.dirty.piece = true;
  }

  debugSetActive(type: PieceType, x?: number, y = 1, rotation: Rotation = 0) {
    const p: ActivePiece = { id: this.s.nextPieceId++, type, rotation, x: x ?? spawnX(type, this.s.meter.width), y };
    this.s.active = p;
    this.lowestY = p.y;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.updateGhost();
    if (this.s.phase === 'idle') this.s.phase = 'falling';
    this.dirty.piece = true;
  }

  debugSetQueue(types: PieceType[]) {
    this.s.queue = types.slice();
    this.dirty.hud = true;
  }

  debugSetMeasures(n: number) {
    this.s.measuresCleared = n;
    this.setLevel(levelFor(this.levelBase, n));
  }

  debugGameOver() {
    this.gameOver('blockOut');
  }

  debugStageClear() {
    this.s.phase = 'stageClear';
    this.s.active = null;
    this.events.push({ type: 'stageClear' });
  }
}

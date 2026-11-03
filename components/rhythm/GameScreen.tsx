'use client';
// 게임 화면(§13) — 엔진(순수 로직) · 화면 스냅숏(Zustand) · 소리(Tone.js) · 입력(키보드·버튼·제스처)을 잇는다.
//  레이아웃(360×780 기준): HUD 48 · 악보 패널 96(모자라면 80) · [박 번호 띠] · 보드 W×16 + 오른쪽 기둥 · 조작 버튼 72
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CHORD_COLOR } from '@/lib/music/chords';
import { asset } from '@/lib/music/assets';
import { setMasterVolume, setMuted, unlockAudio, useAudioUnlocked } from '@/lib/music/audio';
import { useKeyboard, type GameAction } from '@/lib/game/keyboard';
import { useBoardGestures } from '@/lib/game/gestures';
import { useRafLoop, useVisibilityPause } from '@/lib/game/loop';
import { HoldRepeater } from '@/lib/game/repeat';
import { cellSize, useViewport } from '@/lib/game/layout';
import { RhythmEngine, type ClearEvent, type EngineEvent } from '@/lib/rhythm/engine';
import { STAGES } from '@/lib/rhythm/meters';
import { patternFromKey } from '@/lib/rhythm/patterns';
import { HIDDEN_ROWS, type Meter, type MeasureResult, type PieceType, type Rotation, type StageConfig } from '@/lib/rhythm/types';
import { formatScore } from '@/lib/utils';
import { RhythmAudio } from '@/audio/rhythm';
import { useRhythmSave, useRhythmView, type ViewState } from '@/store/rhythm';
import { useFloaters } from '@/components/shell/FloatingTexts';
import { toast } from '@/components/shell/Toast';
import { R, beatNumArt } from './art';
import { BoardView } from './Board';
import { Controls, type ControlHandlers } from './Controls';
import { exposeDebug, parseRow } from './debug';
import { Hud } from './Hud';
import { MeterCard, PauseDialog, StageCard, Summary, type SummaryData } from './Overlays';
import { ScorePanel } from './ScorePanel';
import { SidePanel } from './SidePanel';
import { useElementSize } from './useElementSize';

export interface Launch {
  key: number;
  mode: 'campaign' | 'endless';
  stage: StageConfig;
}

type Overlay = 'card' | 'playing' | 'paused' | 'meter' | 'stageClear' | 'gameOver';

interface Badge {
  key: string;
  src: string;
  x: number;
  y: number;
  delay: number;
}

const KIND_COLOR: Record<string, string> = {
  measure: '#FFC83D',
  lines: '#FFC83D',
  sync: '#FF9B3D',
  pattern: '#7FE5C4',
  patternNew: '#FF8FB1',
  tie: '#7CC8FF',
  combo: '#FF8FB1',
  perfect: '#FFF0A8',
  drop: '#B49CFF',
};

/** 떠오르는 글자 목록: 같은 종류(당김음·붙임줄)와 같은 이름(화음·패턴)은 묶어서 ×n */
export function displayItems(c: ClearEvent): { text: string; color: string; big: boolean }[] {
  const order = ['measure', 'lines', 'sync', 'chord', 'patternNew', 'pattern', 'tie', 'combo', 'perfect'];
  const groups = new Map<string, { kind: string; label: string; points: number; n: number; color: string }>();
  for (const it of c.items) {
    const kind = it.kind ?? 'measure';
    let color = KIND_COLOR[kind] ?? '#FFC83D';
    if (kind === 'chord') {
      const r = c.results.find((x) => x.y === it.y);
      if (r?.chord) color = CHORD_COLOR[r.chord];
    }
    const key = kind === 'sync' || kind === 'tie' ? kind : `${kind}:${it.label}`;
    const g = groups.get(key);
    const count = kind === 'sync' ? (c.results.find((x) => x.y === it.y)?.syncopationCount ?? 1) : kind === 'tie' ? Math.round(it.points / 30) : 1;
    if (g) {
      g.points += it.points;
      g.n += count;
    } else groups.set(key, { kind, label: it.label, points: it.points, n: count, color });
  }
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((g) => {
      let label = g.label;
      if (g.kind === 'sync') label = g.n > 1 ? `당김음 ×${g.n}` : '당김음';
      else if (g.kind === 'tie') label = g.n > 1 ? `붙임줄 ×${g.n}` : '붙임줄';
      else if (g.n > 1) label = `${g.label} ×${g.n}`;
      return { text: `${label} +${formatScore(g.points)}`, color: g.color, big: g.kind === 'lines' || g.kind === 'perfect' || g.kind === 'patternNew' };
    });
}

function syncView(e: RhythmEngine, force = false) {
  const s = e.s;
  const d = e.dirty;
  const patch: Partial<ViewState> = {};
  if (d.board || force) {
    patch.board = s.board.map((r) => r.slice());
    patch.meter = s.meter;
  }
  if (d.piece || force) {
    patch.active = s.active ? { ...s.active } : null;
    patch.ghostY = s.ghostY;
  }
  if (d.hud || force) {
    patch.hold = s.hold;
    patch.holdUsed = s.holdUsed;
    patch.next = s.queue.slice(0, 2);
    patch.score = s.score;
    patch.level = s.level;
    patch.bpm = s.bpm;
    patch.measures = s.measuresCleared;
    patch.combo = s.combo;
    patch.phase = s.phase;
  }
  if (Object.keys(patch).length) useRhythmView.setState(patch);
  d.board = d.piece = d.hud = false;
}

export interface GameScreenProps {
  launch: Launch;
  debug: boolean;
  /** 설정 창이 열려 있으면 일시정지 창을 잠깐 숨긴다 */
  settingsOpen: boolean;
  onMenu: () => void;
  onHome: () => void;
  onRestart: () => void;
  onNextStage: () => void;
  openSettings: () => void;
}

export function GameScreen({ launch, debug, settingsOpen, onMenu, onHome, onRestart, onNextStage, openSettings }: GameScreenProps) {
  const settings = useRhythmSave((s) => s.data.settings);
  const save = useRhythmSave.getState;
  const [engine] = useState(
    () =>
      new RhythmEngine({
        mode: launch.mode,
        stage: launch.stage,
        strictNotation: useRhythmSave.getState().data.settings.strictNotation,
        patterns: useRhythmSave.getState().data.patterns,
      }),
  );
  const audioRef = useRef<RhythmAudio | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlayState] = useState<Overlay>('card');
  const overlayRef = useRef<Overlay>('card');
  const setOverlay = useCallback((o: Overlay) => {
    overlayRef.current = o;
    setOverlayState(o);
  }, []);
  const [meterCard, setMeterCard] = useState<{ meter: Meter; text: string } | null>(null);
  const [meterTip, setMeterTip] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [showRests, setShowRests] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const floaters = useFloaters();
  const measures = useRef(new Map<number, MeasureResult>());
  /** 디버그: 소리 쪽에서 일어난 일(마디 시작·끝, 시각) */
  const audioLog = useRef<{ t: number; ev: string; id?: number }[]>([]);
  const meter = useRhythmView((s) => s.meter);
  const stage = launch.stage;
  const rules = engine.rules;
  const strict = settings.strictNotation || stage.rules.strictNotation;
  const ghostPreview = settings.ghostPreview ?? (launch.mode === 'campaign' && stage.id <= 3);

  // ───────────── 레이아웃(§13: 칸 = min((화면폭 − 88)/W, 보드 높이/16)) ─────────────
  const vp = useViewport();
  const size = useElementSize(rootRef);
  const colW = size.w || vp.width;
  const colH = size.h || vp.height;
  const W = meter.width;
  const strip = rules.beatColoring ? 20 : 0;
  const ctrlH = settings.controls === 'gestures' ? 30 : 72;
  const fixed = 48 + ctrlH + strip + 18;
  let panelH = 96;
  let cell = cellSize(W, 16, colW, colH - fixed - panelH);
  const widthCell = cellSize(W, 16, colW, 100000);
  if (cell < widthCell) {
    // 세로 공간이 모자라면 악보 패널을 80px로 줄인다
    panelH = 80;
    cell = cellSize(W, 16, colW, colH - fixed - panelH);
  }
  const boardW = W * cell;
  const sideW = Math.max(60, Math.min(92, colW - boardW - 22));
  // 넓은 보드(12/8 등)는 칸이 가로로 정해져 세로가 남는다 — 남는 자리에 스테이지 안내를 둔다
  const spare = colH - fixed - panelH - 16 * cell;

  // ───────────── 처음 스냅숏 · 소리 준비 · 정리 ─────────────
  useLayoutEffect(() => {
    useRhythmView.setState({ clearing: null, panel: null, playhead: null, beat: { cell: 0, accent: false, n: 0 } });
    syncView(engine, true);
  }, [engine]);

  useEffect(() => {
    const a = new RhythmAudio(engine.s.meter);
    a.hooks = {
      onMeasureStart: (id) => {
        if (debug) audioLog.current.push({ t: performance.now(), ev: 'start', id });
        const r = measures.current.get(id);
        if (r) useRhythmView.setState({ panel: { id, result: r } });
      },
      onCell: (id, cell) => useRhythmView.setState({ playhead: { id, cell } }),
      onMeasureEnd: (id) => {
        if (debug) audioLog.current.push({ t: performance.now(), ev: 'end', id });
        measures.current.delete(id);
        const p = useRhythmView.getState().playhead;
        if (p && p.id === id) useRhythmView.setState({ playhead: null });
      },
      onBeat: (cell, accent) => useRhythmView.setState((s) => ({ beat: { cell, accent, n: s.beat.n + 1 } })),
      onDropped: (id) => {
        if (debug) audioLog.current.push({ t: performance.now(), ev: 'dropped', id });
        measures.current.delete(id);
      },
    };
    audioRef.current = a;
    return () => {
      a.dispose();
      if (audioRef.current === a) audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // 설정 → 소리
  useEffect(() => {
    setMasterVolume(settings.volume);
    setMuted(!settings.sound);
  }, [settings.volume, settings.sound]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.metronome = settings.metronome;
  }, [settings.metronome]);
  useEffect(() => {
    engine.setStrictNotation(settings.strictNotation);
  }, [engine, settings.strictNotation]);

  const beginAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a || a.isStarted) return;
    a.begin({ bpm: engine.s.bpm, meter: engine.s.meter, pitchSound: engine.rules.pitchSound, metronome: useRhythmSave.getState().data.settings.metronome });
    if (engine.paused) a.pause();
  }, [engine]);

  // 소리가 늦게 켜져도(첫 터치가 게임 중) 메트로놈·연주를 시작한다
  const unlocked = useAudioUnlocked();
  useEffect(() => {
    if (unlocked && (overlay === 'playing' || overlay === 'paused' || overlay === 'meter')) beginAudio();
  }, [unlocked, overlay, beginAudio]);

  // ───────────── 연출 ─────────────
  const shake = useCallback(() => {
    const el = shakeRef.current;
    if (!el) return;
    el.classList.remove('rh-shake');
    void el.offsetWidth;
    el.classList.add('rh-shake');
  }, []);

  const rowTop = useCallback((y: number) => (y - HIDDEN_ROWS) * cell, [cell]);

  const onClear = useCallback(
    (c: ClearEvent) => {
      const a = audioRef.current;
      useRhythmView.setState({ clearing: c });
      // 떠오르는 점수 글자(§10): 항목 이름 그대로. 여러 줄이 함께 지워지면 같은 항목은 묶어서(×n) 보여 준다
      const shown = displayItems(c);
      const topY = rowTop(c.rows[0]);
      // 지워지는 줄(과 그 위로 떠오르는 음표 기호) 위에서부터 위로 쌓는다
      const anchor = Math.max(16 + (shown.length - 1) * 24, topY - cell * 1.35);
      shown.forEach((it, i) => {
        floaters.add({ text: it.text, x: boardW / 2, y: Math.max(4, anchor - i * 24), color: it.color, size: it.big ? 21 : 17, delay: i * 120 });
      });
      // 보너스 배지: 종류마다 하나씩, 지워진 줄 바로 위에 한 줄로
      const kinds = new Set(c.items.map((it) => it.kind));
      const list: string[] = [];
      if (kinds.has('sync')) list.push('sync');
      if (kinds.has('chord')) list.push('chord');
      if (kinds.has('patternNew') || kinds.has('pattern')) list.push('pattern');
      if (c.combo >= 1) list.push('combo');
      if (c.perfect) list.push('perfect');
      const step = cell * 1.25;
      setBadges(
        list.map((b, j) => ({
          key: `${c.id}-${b}`,
          src: R(`badges/badge-${b}.svg`),
          x: boardW / 2 + (j - (list.length - 1) / 2) * step,
          y: topY + cell * 0.1,
          delay: 80 + j * 90,
        })),
      );

      // 연주 큐(위→아래) + 악보 패널
      const items = c.results.map((r, i) => {
        const id = c.id * 10 + i;
        measures.current.set(id, r);
        return { id, result: r };
      });
      if (a && a.ready && a.isStarted) {
        if (!a.busy) useRhythmView.setState({ panel: items[0], playhead: null });
        a.enqueue(items);
      } else {
        useRhythmView.setState({ panel: items[items.length - 1], playhead: null });
      }
      if (c.items.some((it) => it.kind === 'sync')) a?.sfx('sync');
      if (c.newPatterns.length) {
        a?.sfx('fanfare');
        for (const k of c.newPatterns) {
          const p = patternFromKey(k);
          // 한 줄로(악보 패널을 가리지 않게). 리듬은 악보 패널·도감에 보인다
          if (p) toast(`새 패턴! ${p.def.name}`, { icon: R('badges/badge-pattern.svg'), ms: 2000 });
        }
      }
      if (c.results.some((r) => r.patternId)) save().mergePatterns(engine.patternCounts);
    },
    [boardW, cell, engine, floaters, rowTop, save],
  );

  const finishGame = useCallback(
    (kind: 'stageClear' | 'gameOver') => {
      const a = audioRef.current;
      a?.finish();
      a?.sfx(kind === 'stageClear' ? 'stageClear' : 'gameOver');
      const s = engine.s;
      save().mergePatterns(engine.patternCounts);
      const rec = save().recordGame({
        mode: launch.mode,
        meterId: stage.meterId,
        stageId: launch.mode === 'campaign' ? stage.id : null,
        score: s.score,
        cleared: kind === 'stageClear',
      });
      const hasNext = launch.mode === 'campaign' && STAGES.some((x) => x.id === stage.id + 1);
      setSummary({
        kind,
        mode: launch.mode,
        stage,
        score: s.score,
        level: s.level,
        stats: s.stats,
        rules: engine.rules,
        newHigh: rec.newHigh,
        firstClear: rec.firstClear,
        hasNext,
      });
      setOverlay(kind);
    },
    [engine, launch.mode, save, setOverlay, stage],
  );

  const handleEvents = useCallback(
    (evs: EngineEvent[]) => {
      const a = audioRef.current;
      let dropped = false;
      for (const ev of evs) {
        switch (ev.type) {
          case 'move':
            a?.sfx('move');
            break;
          case 'rotate':
            a?.sfx('rotate');
            break;
          case 'hold':
            a?.sfx('hold');
            break;
          case 'hardDrop':
            dropped = true;
            a?.sfx('hardDrop');
            shake();
            break;
          case 'lock': {
            if (!dropped) a?.sfx('lock');
            if (ev.dropPoints > 0) {
              const xs = ev.cells.map(([x]) => x);
              const ys = ev.cells.map(([, y]) => y);
              floaters.add({
                text: `내리기 +${ev.dropPoints}`,
                x: Math.max(42, Math.min(boardW - 42, ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * cell)),
                y: Math.max(4, rowTop(Math.min(...ys)) - 4),
                color: KIND_COLOR.drop,
                size: 13,
              });
            }
            break;
          }
          case 'clear':
            onClear(ev.clear);
            break;
          case 'clearDone':
            useRhythmView.setState({ clearing: null });
            break;
          case 'levelUp':
            a?.setBpm(ev.bpm);
            a?.sfx('levelUp');
            toast(`레벨 ${ev.level}! 조금 더 빨라져요`, { icon: R('icons/icon-metronome.svg'), ms: 1800 });
            break;
          case 'meterChange':
            a?.setMeter(ev.meter);
            engine.pause();
            a?.pause();
            setMeterCard({ meter: ev.meter, text: ev.text });
            setMeterTip(ev.text);
            setOverlay('meter');
            break;
          case 'stageClear':
            finishGame('stageClear');
            break;
          case 'gameOver':
            finishGame('gameOver');
            break;
          default:
            break;
        }
      }
    },
    [boardW, cell, engine, finishGame, floaters, onClear, rowTop, setOverlay, shake],
  );

  const pump = useCallback(() => {
    const evs = engine.drainEvents();
    if (evs.length) handleEvents(evs);
    syncView(engine);
  }, [engine, handleEvents]);

  // ───────────── 게임 루프: requestAnimationFrame 하나 ─────────────
  const repeater = useMemo(
    () =>
      new HoldRepeater<'left' | 'right'>((a) => {
        engine.move(a === 'left' ? -1 : 1);
      }),
    [engine],
  );
  const loopErr = useRef(0);
  useRafLoop(
    (dt, now) => {
      // 공용 루프는 콜백이 던지면 다음 프레임을 예약하지 못한다 — 여기서 막는다(게임이 멈추지 않게)
      try {
        repeater.update(now);
        engine.update(dt);
        pump();
      } catch (e) {
        if (loopErr.current++ < 3) console.error('[rhythm] frame', e);
      }
    },
    overlay === 'playing',
  );

  // ───────────── 입력 ─────────────
  const playing = () => overlayRef.current === 'playing';
  const act = useMemo(
    () => ({
      moveDown: (dir: 'left' | 'right') => {
        if (!playing()) return;
        repeater.up(dir === 'left' ? 'right' : 'left');
        repeater.down(dir, performance.now());
        pump();
      },
      moveUp: (dir: 'left' | 'right') => repeater.up(dir),
      shift: (d: -1 | 1) => {
        if (!playing()) return;
        engine.move(d);
        pump();
      },
      rotate: (d: 1 | -1) => {
        if (!playing()) return;
        engine.rotate(d);
        pump();
      },
      soft: (on: boolean) => {
        if (!playing() && on) return;
        engine.setSoftDrop(on);
      },
      hard: () => {
        if (!playing()) return;
        engine.hardDrop();
        pump();
      },
      hold: () => {
        if (!playing()) return;
        engine.hold();
        pump();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, repeater, pump],
  );

  const pause = useCallback(() => {
    if (overlayRef.current !== 'playing') return;
    engine.pause();
    engine.setSoftDrop(false);
    audioRef.current?.pause();
    repeater.clear();
    syncView(engine);
    setOverlay('paused');
  }, [engine, repeater, setOverlay]);

  const resume = useCallback(() => {
    if (overlayRef.current !== 'paused' && overlayRef.current !== 'meter') return;
    engine.resume();
    audioRef.current?.resume();
    syncView(engine);
    setOverlay('playing');
  }, [engine, setOverlay]);

  const start = useCallback(() => {
    // 반드시 터치·클릭 처리 안에서 소리를 켠다(iOS)
    unlockAudio()
      .then(() => {
        beginAudio();
        audioRef.current?.sfx('start');
      })
      .catch(() => undefined);
    engine.start();
    pump();
    setOverlay('playing');
  }, [beginAudio, engine, pump, setOverlay]);

  useKeyboard(
    (a: GameAction) => {
      switch (a) {
        case 'left':
        case 'right':
          act.moveDown(a);
          break;
        case 'rotateCW':
          act.rotate(1);
          break;
        case 'rotateCCW':
          act.rotate(-1);
          break;
        case 'softDrop':
          act.soft(true);
          break;
        case 'hardDrop':
          act.hard();
          break;
        case 'hold':
          act.hold();
          break;
        case 'pause':
          pause();
          break;
      }
    },
    (a: GameAction) => {
      if (a === 'left' || a === 'right') act.moveUp(a);
      if (a === 'softDrop') act.soft(false);
    },
    overlay === 'playing',
  );

  // 멈춘 동안 P 로 이어 하기
  useEffect(() => {
    if (overlay !== 'paused') return;
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' && !e.repeat) {
        e.preventDefault();
        resume();
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [overlay, resume]);

  useVisibilityPause(() => pause());

  useBoardGestures(boardRef, {
    enabled: settings.controls !== 'buttons' && overlay === 'playing',
    cellPx: cell,
    onShift: (d) => act.shift(d),
    onTap: () => act.rotate(1),
    onTwoFingerTap: () => act.rotate(-1),
    onSoftDrop: (on) => act.soft(on),
    onHardDrop: () => act.hard(),
    onFlickUp: () => act.hold(),
  });

  const controlHandlers = useMemo<ControlHandlers>(
    () => ({
      leftDown: () => act.moveDown('left'),
      leftUp: () => act.moveUp('left'),
      rightDown: () => act.moveDown('right'),
      rightUp: () => act.moveUp('right'),
      rotateCW: () => act.rotate(1),
      rotateCCW: () => act.rotate(-1),
      softDown: () => act.soft(true),
      softUp: () => act.soft(false),
      hardDrop: () => act.hard(),
    }),
    [act],
  );

  // ───────────── 디버그 훅(?debug) ─────────────
  useEffect(() => {
    if (!debug) return;
    return exposeDebug('game', {
      engine: () => engine,
      state: () => engine.s,
      audio: () => ({ ...(audioRef.current?.debugInfo() ?? {}), log: audioLog.current.slice() }),
      load: (rows: string[]) => {
        engine.debugLoadRows(rows.map(parseRow));
        syncView(engine, true);
      },
      active: (type: PieceType, x?: number, y?: number, rot?: Rotation) => {
        engine.debugSetActive(type, x, y ?? 2, rot ?? 0);
        syncView(engine, true);
      },
      queue: (types: PieceType[]) => {
        engine.debugSetQueue(types);
        syncView(engine, true);
      },
      hold: (t: PieceType | null) => {
        engine.s.hold = t;
        engine.dirty.hud = true;
        syncView(engine);
      },
      freeze: (on: boolean) => {
        engine.gravityFrozen = on;
      },
      drop: () => act.hard(),
      measures: (n: number) => {
        engine.debugSetMeasures(n);
        engine.dirty.hud = true;
        syncView(engine);
      },
      score: (n: number) => {
        engine.s.score = n;
        engine.dirty.hud = true;
        syncView(engine);
      },
      gameOver: () => {
        engine.debugGameOver();
        pump();
      },
      stageClear: () => {
        engine.debugStageClear();
        pump();
      },
      pause: () => pause(),
      resume: () => resume(),
      start: () => start(),
      rests: (on: boolean) => setShowRests(on),
      playhead: (cell: number | null) => {
        const p = useRhythmView.getState().panel;
        useRhythmView.setState({ playhead: p && cell !== null ? { id: p.id, cell } : null });
      },
      /** 연출을 멈춘 채로 보기(스크린샷): 지우기 연출 시간을 멈춘다 */
      holdClear: () => {
        const c = useRhythmView.getState().clearing;
        return c ? c.id : null;
      },
    });
  }, [act, debug, engine, pause, pump, resume, start]);

  const titleText = launch.mode === 'campaign' ? `스테이지 ${stage.id} · ${stage.name}` : `무한 모드 · ${stage.meterId}`;
  const target = launch.mode === 'campaign' ? stage.targetMeasures : 0;

  return (
    <div ref={rootRef} className="relative flex h-full w-full flex-col">
      <Hud onPause={pause} title={titleText} />
      <div className="pt-1">
        <ScorePanel width={colW - 16} height={panelH} rules={rules} strict={strict} />
      </div>
      {spare > 84 && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-2xl border-2 border-line/70 bg-panel/70 px-2.5 py-1.5" style={{ maxHeight: spare - 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(R('mascot/ttokttak-normal.svg'))} alt="" className="h-12 w-auto shrink-0" draggable={false} />
          <p className="text-[14px] leading-snug text-ink-dim">{meterTip ?? stage.card.text}</p>
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-end justify-center gap-1.5 px-1.5 pb-1 pt-2">
        <div className="flex flex-col items-center">
          {strip > 0 && (
            // 박 번호 띠(스테이지 3부터) — 숫자 부분만 보이게 위아래를 잘라 쓴다
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset(beatNumArt(meter.id))} alt="" draggable={false} className="pointer-events-none select-none" style={{ width: boardW, height: strip, objectFit: 'cover' }} />
          )}
          <BoardView
            ref={boardRef}
            shakeRef={shakeRef}
            cell={cell}
            label={rules.showSolfege}
            beats={rules.beatColoring}
            ghostPreview={ghostPreview}
            ties={rules.ties}
            syncHighlight={rules.syncopationBonus}
            showRests={showRests}
            floaters={floaters.items}
          >
            {badges.map((b) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={b.key}
                src={asset(b.src)}
                alt=""
                className="rh-badge pointer-events-none z-30"
                style={{ left: b.x, top: b.y, width: cell * 1.15, height: cell * 1.15, animationDelay: `${b.delay}ms` }}
                draggable={false}
              />
            ))}
          </BoardView>
        </div>
        <div style={{ height: 16 * cell + strip }}>
          <SidePanel
            width={sideW}
            label={rules.showSolfege}
            target={target}
            onHold={() => act.hold()}
            showRests={showRests}
            onToggleRests={() => setShowRests((v) => !v)}
            compact={16 * cell + strip < 430}
          />
        </div>
      </div>
      {ctrlH === 72 ? (
        <Controls width={colW} showCcw={settings.showCcwButton} h={controlHandlers} />
      ) : (
        <div className="flex h-[30px] items-center justify-center px-2 text-center text-[12px] text-ink-dim">밀기: 이동 · 톡: 회전 · 아래로 휙: 떨어뜨리기 · 위로 휙: 보관</div>
      )}

      {overlay === 'card' && <StageCard stage={stage} mode={launch.mode} onStart={start} onBack={onMenu} />}
      {overlay === 'meter' && meterCard && (
        <MeterCard
          meter={meterCard.meter}
          text={meterCard.text}
          onContinue={() => {
            setMeterCard(null);
            resume();
          }}
        />
      )}
      <PauseDialog open={overlay === 'paused' && !settingsOpen} onResume={resume} onRestart={onRestart} onSettings={openSettings} onMenu={onMenu} onHome={onHome} />
      {(overlay === 'stageClear' || overlay === 'gameOver') && summary && (
        <Summary data={summary} strict={strict} onNext={onNextStage} onRetry={onRestart} onMenu={onMenu} />
      )}
    </div>
  );
}

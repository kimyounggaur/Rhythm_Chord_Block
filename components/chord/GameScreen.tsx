'use client';
// 화음 모드 한 판 — 엔진(순수 로직)을 requestAnimationFrame 하나로 돌리고(§16 주의 3), 화면·소리는 엔진 이벤트를 따라간다.
// 해결 루프는 엔진이 먼저 다 계산하고(ChainResult) 화면은 장면을 차례로 보여 준다(§16 주의 2).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { preloadImages } from '@/lib/music/assets';
import { getTone, isAudioUnlocked, unlockAudio } from '@/lib/music/audio';
import { useRafLoop, useVisibilityPause } from '@/lib/game/loop';
import { HoldRepeater } from '@/lib/game/repeat';
import { useKeyboard, type GameAction } from '@/lib/game/keyboard';
import { useBoardGestures } from '@/lib/game/gestures';
import { cellSize } from '@/lib/game/layout';
import { useFloaters } from '@/components/shell/FloatingTexts';
import { ToastHost, toast } from '@/components/shell/Toast';
import { ChordEngine, type EngineEvent } from '@/lib/chord/engine';
import { PUZZLES, activeTones, chordOf, stageById, STAGES } from '@/lib/chord/defs';
import { findHints } from '@/lib/chord/hints';
import { stripInfo, type StripInfo } from '@/lib/chord/strip';
import { collectionDef } from '@/lib/chord/collection';
import { effectiveHints, effectiveInterval, highScoreKey, isPuzzleUnlocked, isStageUnlocked } from '@/lib/chord/save';
import { romanSeq } from '@/lib/chord/goals';
import type { Cell, ChordId, Pitch } from '@/lib/chord/types';
import { ChordSound } from '@/audio/chord';
import { useChordStore, type Session } from '@/store/chord';
import { BoardView, type ChipItem, type FxItem } from './BoardView';
import { Controls, GoalPanel, Hud, IntervalPanel, Mascot, NextPanel, StripZone, type ControlAction } from './GameParts';
import { IntroCard, PauseCard, ResultCard } from './Overlays';
import { burstArt, preloadList, shardsArt } from './art';
import { ChordBadge, Img } from './bits';
import { RText } from './Roman';

type ResultKind = 'clear' | 'over' | 'puzzleSolved' | 'puzzleFail';

let fxSeq = 0;

function centroid(cells: Cell[], cell: number): [number, number] {
  const sx = cells.reduce((a, c) => a + c[0], 0) / cells.length;
  const sy = cells.reduce((a, c) => a + c[1], 0) / cells.length;
  return [(sx + 0.5) * cell, (sy - 0.5) * cell];
}

export default function GameScreen({ session }: { session: Session }) {
  const save = useChordStore((s) => s.save);
  const settings = save.settings;
  const updateSettings = useChordStore((s) => s.updateSettings);
  const recordGame = useChordStore((s) => s.recordGame);
  const setCollections = useChordStore((s) => s.setCollections);
  const quitGame = useChordStore((s) => s.quitGame);
  const restart = useChordStore((s) => s.restart);
  const startGame = useChordStore((s) => s.startGame);

  const puzzle = session.puzzleId ? PUZZLES.find((p) => p.id === session.puzzleId) ?? null : null;
  const stage = puzzle ? stageById(3) : stageById(session.stageId);
  const [engine] = useState(
    () => new ChordEngine({ mode: session.mode, stage, puzzle: puzzle ?? undefined, collections: useChordStore.getState().save.collections }),
  );
  const rules = engine.rules;
  const active = rules.activeChords;
  const inactive = useMemo(() => {
    const on = activeTones(active);
    return new Set<Pitch>((['도', '레', '미', '파', '솔', '라', '시', '솔♯'] as Pitch[]).filter((p) => !on.has(p)));
  }, [active]);
  const hintsOn = effectiveHints(settings, rules);
  const intervalOn = effectiveInterval(settings, rules);
  const key: 'C' | 'a' = chordOf(active[0]).key;

  // ── 화면 상태
  const [, setVersion] = useState(0);
  const verRef = useRef(-1);
  const [overlay, setOverlay] = useState<'intro' | 'pause' | 'result' | null>('intro');
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState<{ kind: ResultKind; score: number; best: number | null; note: string | null } | null>(null);
  const [strip, setStrip] = useState<{ info: StripInfo; key: number } | null>(null);
  const [fx, setFx] = useState<FxItem[]>([]);
  const [chips, setChips] = useState<ChipItem[]>([]);
  const [chain, setChain] = useState<{ n: number; key: number } | null>(null);
  const [allClearKey, setAllClearKey] = useState<number | null>(null);
  const [tense, setTense] = useState(false);
  const [happy, setHappy] = useState(false);
  const [showPuzzleHint, setShowPuzzleHint] = useState(false);
  const floaters = useFloaters();

  const soundRef = useRef<ChordSound | null>(null);
  if (!soundRef.current) soundRef.current = new ChordSound();
  const sound = soundRef.current;
  const timers = useRef<number[]>([]);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 360, h: 596 });

  // ── 칸 크기(§13: min((화면폭 − 88) / 7, 보드 영역 높이 / 14)) — 맨 위 숨김 줄 40% 를 보여 줄 자리만큼 뺀다
  useEffect(() => {
    const el = midRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    const ro = new ResizeObserver(() => setBox({ w: root.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    ro.observe(root);
    setBox({ w: root.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const cell = cellSize(7, 14, box.w, Math.floor(((box.h - 6) * 14) / 14.4));
  const peek = Math.round(cell * 0.4);

  // ── 준비·정리
  useEffect(() => {
    preloadImages(preloadList());
    sound.setKey(key);
    const t = timers.current;
    return () => {
      t.forEach((id) => window.clearTimeout(id));
      sound.dispose();
    };
  }, [sound, key]);

  useEffect(() => {
    sound.setPadEnabled(settings.tensionPad && rules.tensionPad);
  }, [sound, settings.tensionPad, rules.tensionPad]);

  // ── 입력
  const repeater = useMemo(() => new HoldRepeater<'left' | 'right'>((a) => engine.move(a === 'left' ? -1 : 1)), [engine]);
  const softSources = useRef(new Set<string>());
  const setSoft = useCallback(
    (src: string, on: boolean) => {
      if (on) softSources.current.add(src);
      else softSources.current.delete(src);
      engine.setSoftDrop(softSources.current.size > 0);
    },
    [engine],
  );

  const playing = started && !ended && overlay === null;

  const pauseGame = useCallback(() => {
    if (!started || ended) return;
    engine.pause();
    sound.pause();
    repeater.clear();
    softSources.current.clear();
    setOverlay('pause');
  }, [engine, sound, repeater, started, ended]);

  const resumeGame = useCallback(() => {
    setOverlay(null);
    engine.resume();
    sound.resume();
  }, [engine, sound]);

  useVisibilityPause(() => {
    if (playing) pauseGame();
  });

  const onKeyDown = useCallback(
    (a: GameAction) => {
      if (a === 'pause') {
        if (overlay === 'pause') resumeGame();
        else if (overlay === null) pauseGame();
        return;
      }
      if (overlay !== null) return;
      if (a === 'left' || a === 'right') repeater.down(a);
      else if (a === 'rotateCW') engine.rotate(true);
      else if (a === 'rotateCCW') engine.rotate(false);
      else if (a === 'softDrop') setSoft('key', true);
      else if (a === 'hardDrop') engine.hardDrop();
    },
    [engine, overlay, pauseGame, resumeGame, repeater, setSoft],
  );
  const onKeyUp = useCallback(
    (a: GameAction) => {
      if (a === 'left' || a === 'right') repeater.up(a);
      else if (a === 'softDrop') setSoft('key', false);
    },
    [repeater, setSoft],
  );
  useKeyboard(onKeyDown, onKeyUp, started && !ended);

  const onCtrlDown = useCallback(
    (a: ControlAction) => {
      if (!playing) return;
      if (a === 'left' || a === 'right') repeater.down(a);
      else if (a === 'cw') engine.rotate(true);
      else if (a === 'ccw') engine.rotate(false);
      else if (a === 'soft') setSoft('btn', true);
      else if (a === 'hard') engine.hardDrop();
    },
    [engine, playing, repeater, setSoft],
  );
  const onCtrlUp = useCallback(
    (a: ControlAction) => {
      if (a === 'left' || a === 'right') repeater.up(a);
      else if (a === 'soft') setSoft('btn', false);
    },
    [repeater, setSoft],
  );

  useBoardGestures(boardRef, {
    enabled: playing && settings.controls !== 'buttons',
    cellPx: cell,
    onShift: (d) => engine.move(d),
    onTap: () => engine.rotate(true),
    onTwoFingerTap: () => engine.rotate(false),
    onSoftDrop: (on) => setSoft('gesture', on),
    onHardDrop: () => engine.hardDrop(),
  });

  // ── 엔진 이벤트 → 연출·소리
  const finish = useCallback(
    (kind: ResultKind) => {
      setEnded(true);
      repeater.clear();
      softSources.current.clear();
      const st = useChordStore.getState().save;
      const best = session.mode === 'puzzle' ? null : st.highScores[highScoreKey(session.mode === 'endless' ? 'endless' : 'campaign', stage.id)] ?? 0;
      recordGame({ mode: session.mode, stageId: stage.id, puzzleId: puzzle?.id, score: engine.score, cleared: kind === 'clear' || kind === 'puzzleSolved' });
      setCollections(engine.collections);
      if (kind === 'clear' || kind === 'puzzleSolved') sound.stageClear();
      else sound.gameOver();
      const nextStage = STAGES.find((s) => s.id === stage.id + 1);
      const note =
        kind === 'puzzleSolved'
          ? `${puzzle!.goal.chain}연쇄 성공! ${romanSeq(engine.lastChain?.progression ?? [])}`
          : kind === 'puzzleFail'
            ? '조각을 다 썼어요. 다시 해 볼까요?'
            : kind === 'clear' && nextStage
              ? `스테이지 ${nextStage.id} '${nextStage.name}' 열림!`
              : kind === 'clear'
                ? '마지막 스테이지까지 깼어요!'
                : null;
      later(kind === 'over' || kind === 'puzzleFail' ? 900 : 700, () => {
        setResult({ kind, score: engine.score, best: best === null ? null : Math.max(best, 0), note });
        setOverlay('result');
      });
    },
    [engine, later, puzzle, recordGame, repeater, session.mode, setCollections, sound, stage.id],
  );

  const onStep = useCallback(
    (ev: Extract<EngineEvent, { type: 'step' }>) => {
      const frame = ev.phase.frame;
      const pops = frame.pops!;
      const board = frame.board;
      const step = ev.step;
      const items: FxItem[] = [];
      const cellsPopped = new Set<string>();
      for (const e of pops.events) {
        for (const [x, y] of e.cells) {
          const k = `${x},${y}`;
          if (cellsPopped.has(k)) continue;
          cellsPopped.add(k);
          const p = board[y][x]?.pitch ?? null;
          items.push({ key: ++fxSeq, kind: 'flash', x: x * cell, y: (y - 1) * cell, size: cell, art: 'chord/fx/fx-tile-flash.svg' });
          items.push({ key: ++fxSeq, kind: 'shards', x: (x + 0.5) * cell, y: (y - 0.5) * cell, size: cell * 1.5, art: shardsArt(p), delay: 90 });
        }
        const [cx, cy] = centroid(e.cells, cell);
        items.push({ key: ++fxSeq, kind: 'burst', x: cx, y: cy, size: cell * 3.6, art: burstArt(e.chord), delay: 60 });
      }
      for (const [x, y] of pops.junkCells) {
        items.push({ key: ++fxSeq, kind: 'shards', x: (x + 0.5) * cell, y: (y - 0.5) * cell, size: cell * 1.2, art: 'chord/fx/fx-sparkle-white.svg', delay: 120 });
      }
      const main = pops.events.find((e) => e.chord === step.mainChord) ?? pops.events[0];
      const [mx, my] = centroid(main.cells, cell);
      if (step.index >= 2) items.push({ key: ++fxSeq, kind: 'ring', x: mx, y: my, size: cell * 2.4, art: 'chord/fx/fx-ring.svg' });
      setFx((f) => [...f.slice(-80), ...items]);
      const ids = new Set(items.map((i) => i.key));
      later(900, () => setFx((f) => f.filter((i) => !ids.has(i.key))));

      // 터짐 표시(§14-3): 화음 칩 + N성부 — 덩어리 위쪽
      const W = cell * 7;
      const chipH = Math.round(cell * 0.82) + 22;
      const newChips: ChipItem[] = pops.events.map((e, i) => {
        const [cx] = centroid(e.cells, cell);
        const top = Math.min(...e.cells.map((c) => c[1]));
        const half = cell * 2.6;
        return {
          key: ++fxSeq,
          chord: e.chord,
          size: e.size,
          x: Math.max(half, Math.min(W - half, cx)),
          y: Math.max(-cell * 0.3, (top - 1) * cell - chipH - 2),
          delay: i * 90,
        };
      });
      // 동시 화음이면 칩을 위로 쌓는다(맨 위에 닿으면 아래로)
      newChips.sort((a, b) => b.y - a.y);
      for (let i = 1; i < newChips.length; i++) {
        if (newChips[i - 1].y - newChips[i].y < chipH) newChips[i].y = newChips[i - 1].y - chipH;
      }
      const overTop = -cell * 0.3 - Math.min(...newChips.map((c) => c.y));
      if (overTop > 0) newChips.forEach((c) => (c.y += overTop));
      setChips(newChips);
      const chipIds = new Set(newChips.map((c) => c.key));
      later(1400, () => setChips((c) => c.filter((x) => !chipIds.has(x.key))));

      setChain({ n: step.index, key: ++fxSeq });

      // 떠오르는 점수 글자(§10): "정격마침 +8", "공통음! +6" … — 칩 위에 한 줄씩(위가 모자라면 덩어리 아래), 단계 점수는 덩어리 가운데
      const lines: { text: string; color?: string; size?: number }[] = [];
      if (step.index >= 2) lines.push({ text: `${step.index}연쇄 +${step.chainPower}`, color: '#FF8FB1', size: 18 });
      if (step.simulLabel) lines.push({ text: `${step.simulLabel} +${step.simulBonus}`, color: '#7FE5C4', size: 18 });
      if (step.reverseHint) lines.push({ text: '역진행', color: '#B9B9F0', size: 17 });
      if (step.progressionName && step.pairBonus > 0) lines.push({ text: `${step.progressionName} +${step.pairBonus}`, color: '#FFE9A8', size: 19 });
      for (const q of step.sequences) lines.push({ text: `${q.name} +${q.bonus}`, color: '#FFC83D', size: 20 });
      const LINE = 23;
      if (step.index >= 2) floaters.clear(); // 앞 단계 글자는 지우고 이번 단계만(겹치지 않게)
      const chipTop = newChips.length ? Math.min(...newChips.map((c) => c.y)) : (Math.min(...main.cells.map((c) => c[1])) - 1) * cell;
      const groupBottom = Math.max(...pops.events.flatMap((e) => e.cells.map((c) => c[1]))) * cell;
      const roomAbove = chipTop - lines.length * LINE > 4;
      const textX = newChips[0]?.x ?? Math.max(cell * 2.2, Math.min(W - cell * 2.2, mx));
      lines.forEach((l, i) => {
        const y = roomAbove ? chipTop - (lines.length - i) * LINE : groupBottom + 6 + i * LINE;
        floaters.add({ text: l.text, x: textX, y, color: l.color, size: l.size, delay: 60 + i * 80 });
      });
      floaters.add({ text: `+${step.score.toLocaleString('ko-KR')}`, x: Math.max(cell * 1.6, Math.min(W - cell * 1.6, mx)), y: Math.max(cell * 0.5, my - cell * 0.4), color: '#FFC83D', size: 26 });
      if (step.index >= 2) {
        setHappy(true);
        later(1300, () => setHappy(false));
      }
    },
    [cell, floaters, later],
  );

  const onChainEnd = useCallback(
    (ev: Extract<EngineEvent, { type: 'chainEnd' }>) => {
      const info = stripInfo(ev.result);
      const k = ++fxSeq;
      setStrip({ info, key: k });
      later(3000, () => setStrip((s) => (s && s.key === k ? null : s)));
      later(500, () => setChain((c) => (c && c.key <= k ? null : c)));
      if (ev.result.allClear) {
        sound.allClear();
        later(350, () => {
          floaters.clear();
          setAllClearKey(k);
        });
        later(2250, () => setAllClearKey((a) => (a === k ? null : a)));
      }
      for (const c of ev.collections) {
        const def = collectionDef(c.id);
        if (!def) continue;
        if (c.first) {
          toast(`새 진행 등록! ${def.name}`, { sub: `${def.description} · +${c.points}점`, icon: 'chord/icons/icon-book.svg', ms: 2600 });
          sound.newCollection();
        } else {
          floaters.add({ text: `도감 ${def.name} +${c.points}`, x: cell * 3.5, y: cell * 2.2, color: '#FF8FB1', size: 17 });
        }
      }
      if (ev.collections.length) setCollections({ ...engine.collections });
    },
    [cell, engine, floaters, later, setCollections, sound],
  );

  const handleEvents = useCallback(
    (evs: EngineEvent[]) => {
      for (const ev of evs) {
        switch (ev.type) {
          case 'land':
            sound.landing(ev.pitches);
            break;
          case 'rotate':
            sound.rotate();
            break;
          case 'chain':
            sound.scheduleChain(ev.result, ev.timeline);
            break;
          case 'step':
            onStep(ev);
            break;
          case 'chainEnd':
            onChainEnd(ev);
            break;
          case 'garbage':
            sound.garbage(ev.count);
            if (ev.count) {
              floaters.add({ text: `방해 타일 ${ev.count}개!`, x: cell * 3.5, y: cell * 1.6, color: '#CFCFCF', size: 17 });
              boardRef.current?.animate(
                [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
                { duration: 200, delay: 120 },
              );
            }
            break;
          case 'levelUp':
            sound.levelUp();
            floaters.add({ text: `레벨 ${ev.level}!`, x: cell * 3.5, y: cell * 5, color: '#7CC8FF', size: 22 });
            break;
          case 'tension':
            setTense(ev.tense);
            sound.setTension(ev.tense);
            break;
          case 'stageClear':
            finish('clear');
            break;
          case 'puzzleSolved':
            finish('puzzleSolved');
            break;
          case 'gameOver':
            finish(ev.reason === 'puzzleFail' ? 'puzzleFail' : 'over');
            break;
          default:
            break;
        }
      }
    },
    [cell, finish, floaters, onChainEnd, onStep, sound],
  );

  // ── 게임 루프(requestAnimationFrame 하나)
  useRafLoop(
    (dt, now) => {
      repeater.update(now);
      engine.update(dt);
      const evs = engine.drainEvents();
      if (evs.length) handleEvents(evs);
      if (engine.version !== verRef.current) {
        verRef.current = engine.version;
        setVersion(engine.version);
      }
    },
    started && !ended && overlay !== 'pause',
  );

  const startPlaying = () => {
    unlockAudio()
      .then(() => sound.start())
      .catch(() => undefined);
    sound.start();
    setOverlay(null);
    setStarted(true);
    engine.start();
    const evs = engine.drainEvents();
    handleEvents(evs);
    verRef.current = engine.version;
    setVersion(engine.version);
  };

  const quit = () => {
    if (started && !ended) {
      recordGame({ mode: session.mode, stageId: stage.id, puzzleId: puzzle?.id, score: engine.score, cleared: false });
      setCollections(engine.collections);
    }
    sound.stop();
    quitGame();
  };

  // 디버그(?debug): 스크린샷·확인용 — 보드 불러오기, 즉시 해결 등
  useEffect(() => {
    if (typeof window === 'undefined' || !/[?&]debug/.test(window.location.search)) return;
    const w = window as unknown as Record<string, unknown>;
    w.__chordDebug = {
      engine,
      start: () => startPlayingRef.current(),
      loadGrid: (rows: string[]) => engine.debugLoadGrid(rows),
      resolveNow: () => engine.debugResolveNow(),
      setPair: (a: Pitch, b: Pitch) => engine.debugSetPair(a, b),
      setQueue: (pairs: [Pitch, Pitch][]) => engine.debugSetQueue(pairs),
      gameOver: () => engine.debugGameOver(),
      clear: () => engine.debugClear(),
      pause: () => pauseRef.current(),
      tension: (on: boolean) => {
        setTense(on);
        sound.setTension(on);
      },
      state: () => engine.getState(),
      audio: () => {
        const T = getTone();
        return { loaded: !!T, unlocked: isAudioUnlocked(), context: T?.getContext().state ?? null, transport: T?.getTransport().state ?? null };
      },
    };
    return () => {
      delete w.__chordDebug;
    };
  }, [engine, sound]);
  const startPlayingRef = useRef(startPlaying);
  startPlayingRef.current = startPlaying;
  const pauseRef = useRef(pauseGame);
  pauseRef.current = pauseGame;

  // ── 그리기
  const view = engine.getView();
  const hints = useMemo(
    () => (hintsOn && view.phase === 'falling' ? findHints(view.board, active, rules.minGroup) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hintsOn, view.phase, view.board, active, rules.minGroup],
  );
  const mood: 'normal' | 'happy' | 'oops' = happy ? 'happy' : tense || ended ? (result?.kind === 'clear' || result?.kind === 'puzzleSolved' ? 'happy' : 'oops') : 'normal';
  const pairKey = engine.pair ? `${engine.pair.axisId}` : 'none';
  const best = session.mode === 'puzzle' ? null : save.highScores[highScoreKey(session.mode === 'endless' ? 'endless' : 'campaign', stage.id)] ?? 0;
  const nextStage = STAGES.find((s) => s.id === stage.id + 1);
  const canNext = result?.kind === 'clear' && nextStage && isStageUnlocked(useChordStore.getState().save, nextStage.id);
  const puzzleIdx = puzzle ? PUZZLES.findIndex((p) => p.id === puzzle.id) : -1;
  const nextPuzzle = puzzleIdx >= 0 ? PUZZLES[puzzleIdx + 1] : undefined;
  const canNextPuzzle = result?.kind === 'puzzleSolved' && nextPuzzle && isPuzzleUnlocked(useChordStore.getState().save, nextPuzzle);

  const idleStrip = (
    <div className="flex max-w-full items-center gap-2 rounded-full border-2 border-line/70 bg-panel/80 py-1 pl-1.5 pr-3">
      <span className="flex shrink-0">
        {active.map((c) => (
          <ChordBadge key={c} chord={c} size={30} />
        ))}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[16px] text-ink">
          <RText text={puzzle ? puzzle.title : session.mode === 'endless' ? `무한 · ${stage.name}` : `${stage.id}. ${stage.name}`} />
        </span>
        <span className="block truncate text-[12px] text-ink-dim">
          <RText
            text={
              puzzle
                ? showPuzzleHint
                  ? puzzle.hint
                  : `${puzzle.goal.chain}연쇄${puzzle.goal.progression ? ` · ${romanSeq(puzzle.goal.progression)}` : ''} 만들기`
                : session.mode === 'endless'
                  ? `최고 ${(best ?? 0).toLocaleString('ko-KR')}점`
                  : active.map((c) => `${chordOf(c).roman} ${chordOf(c).tones.join('')}`).join('  ')
            }
          />
        </span>
      </span>
      {puzzle && (
        <button type="button" aria-label="퍼즐 힌트" className="shrink-0" onClick={() => setShowPuzzleHint((v) => !v)}>
          <Img path="chord/icons/icon-hint.svg" style={{ width: 30, height: 30 }} />
        </button>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="relative flex h-full w-full flex-col overflow-hidden">
      {/* 배경: 차분 ↔ 긴장(§9 긴장과 해결) */}
      <Img path="chord/backgrounds/bg-game.svg" className="absolute inset-0 h-full w-full object-cover" />
      <Img
        path="chord/backgrounds/bg-game-tense.svg"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms]"
        style={{ opacity: tense ? 1 : 0 }}
      />
      <div className="relative z-10 flex h-full flex-col">
        <Hud
          score={engine.score}
          level={engine.level}
          maxChain={engine.stats.maxChain}
          puzzleLeft={puzzle ? engine.queue.length + (engine.pair ? 1 : 0) : null}
          onPause={() => (overlay === 'pause' ? resumeGame() : pauseGame())}
          soundOn={settings.sound}
          onToggleSound={() => {
            unlockAudio().catch(() => undefined);
            updateSettings({ sound: !settings.sound });
          }}
        />
        <StripZone strip={strip?.info ?? null} stripKey={strip?.key ?? 0} idle={idleStrip} width={box.w} />
        <div ref={midRef} className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="flex items-start" style={{ gap: 8, paddingTop: peek }}>
            <BoardView
              view={view}
              cell={cell}
              activeChords={active}
              inactive={inactive}
              hints={hints}
              fx={fx}
              chips={chips}
              chain={chain}
              floaters={floaters.items}
              allClearKey={allClearKey}
              boardRef={boardRef}
            />
            <div className="flex w-[72px] shrink-0 flex-col items-center gap-2" style={{ height: cell * 14 }}>
              <NextPanel pairs={engine.nextPairs} inactive={inactive} />
              {intervalOn && <IntervalPanel pair={view.phase === 'falling' ? engine.pair : null} pairKey={pairKey} />}
              {session.mode === 'campaign' ? (
                <GoalPanel goals={engine.goals} title="목표" />
              ) : session.mode === 'endless' ? (
                <GoalPanel
                  goals={[]}
                  title="무한"
                  lines={
                    <div className="mt-0.5 text-[12px] leading-4 text-ink">
                      조각 {engine.pieces}
                      <div className="text-ink-dim">레벨업까지 {25 - (engine.pieces % 25)}</div>
                    </div>
                  }
                />
              ) : (
                <GoalPanel
                  goals={[]}
                  title="퍼즐"
                  lines={<div className="mt-0.5 text-[12px] leading-4 text-ink">{puzzle!.goal.chain}연쇄</div>}
                />
              )}
              <div className="mt-auto">
                <Mascot mood={mood} size={64} />
              </div>
            </div>
          </div>
        </div>
        {settings.controls !== 'gestures' ? (
          <Controls width={box.w} onDown={onCtrlDown} onUp={onCtrlUp} disabled={!playing} />
        ) : (
          <div className="flex h-9 shrink-0 items-center justify-center px-3 text-center text-[13px] text-ink-dim cm-text-shadow">
            밀어서 이동 · 톡 회전 · 아래로 끌기·튕기기
          </div>
        )}
      </div>
      {/* 도감 첫 달성 알림 — 게임 중에는 점수·진행 띠를 가리지 않게 보드 위쪽 가운데에 */}
      <div className="cm-toasts pointer-events-none absolute inset-x-0 z-40" style={{ top: 112 + peek + cell * 2.4 }}>
        <ToastHost />
      </div>

      {overlay === 'intro' && (
        <IntroCard mode={session.mode} stage={stage} puzzle={puzzle} onStart={startPlaying} onBack={quit} />
      )}
      {overlay === 'pause' && (
        <PauseCard
          onResume={resumeGame}
          onRestart={() => {
            sound.stop();
            if (started && !ended) recordGame({ mode: session.mode, stageId: stage.id, puzzleId: puzzle?.id, score: engine.score, cleared: false });
            restart();
          }}
          onQuit={quit}
          puzzleHint={puzzle?.hint ?? null}
          toggles={[
            { label: '소리', icon: settings.sound ? 'icon-sound-on' : 'icon-sound-off', on: settings.sound, set: (v) => updateSettings({ sound: v }) },
            { label: '힌트', icon: 'icon-hint', on: hintsOn, set: (v) => updateSettings({ hints: v }) },
            { label: '음정', icon: 'icon-interval', on: intervalOn, set: (v) => updateSettings({ intervalLabel: v }) },
            { label: '패드', icon: 'icon-pad', on: settings.tensionPad, set: (v) => updateSettings({ tensionPad: v }) },
          ]}
        />
      )}
      {overlay === 'result' && result && (
        <ResultCard
          kind={result.kind}
          score={result.score}
          best={result.best}
          stats={engine.stats}
          active={active}
          title={puzzle ? puzzle.title : session.mode === 'endless' ? `무한 모드 · ${stage.name}` : `스테이지 ${stage.id} · ${stage.name}`}
          note={result.note}
          onRetry={() => {
            sound.stop();
            restart();
          }}
          onNext={canNext ? () => startGame('campaign', nextStage!.id) : canNextPuzzle ? () => startGame('puzzle', 3, nextPuzzle!.id) : undefined}
          nextLabel={canNextPuzzle ? '다음 퍼즐' : '다음 스테이지'}
          onMenu={() => {
            sound.stop();
            quitGame();
          }}
        />
      )}
    </div>
  );
}

// 리듬 모드의 소리 — 설계서 §9.
//  · Tone.js 는 lib/music/audio.ts 가 동적으로 불러온 것만 쓴다(이 파일은 'tone' 을 직접 import 하지 않는다).
//  · 메트로놈: Transport 에 BPM 을 걸고 8분음표마다 한 번 도는 반복 이벤트에서 박 시작 칸에 클릭(센박은 높은 소리). 기본 켬, -18dB.
//  · 마디 연주 큐: 지워진 마디는 '다음 박 경계'에서 시작, 각 음은 start칸 × 8분음표 시각에 length칸 길이.
//    여러 마디는 끊김 없이 이어서, 대기 최대 3마디(넘치면 가장 오래된 것을 버림). 게임은 멈추지 않는다.
//  · 연주 중 악보 패널의 재생 헤드는 Tone.Draw 로 소리와 같은 시각에 알린다.
//  · 음악 소리는 모두 Transport 시각(틱)으로 예약한다. setTimeout 은 쓰지 않는다.
//    효과음(이동·회전·잠금…)은 박에 맞출 필요가 없어 오디오 시계의 '지금'(Tone.immediate)에 바로 울린다.
import { getTone, isAudioUnlocked, type ToneNS } from '@/lib/music/audio';
import { noteName } from '@/lib/music/solfege';
import { getMeter } from '@/lib/rhythm/meters';
import { BoundedQueue, eighthSeconds, nextBoundaryTick, startCells } from '@/lib/rhythm/playback';
import type { MeasureResult, Meter } from '@/lib/rhythm/types';

export interface QueuedMeasure {
  id: number;
  result: MeasureResult;
}

export interface RhythmAudioHooks {
  /** 마디 연주가 시작될 때(소리와 같은 시각) */
  onMeasureStart?: (id: number) => void;
  /** 재생 헤드가 칸 cell 에 왔을 때 */
  onCell?: (id: number, cell: number) => void;
  onMeasureEnd?: (id: number) => void;
  /** 메트로놈 박(소리를 꺼도 화면 박자 표시는 움직인다) */
  onBeat?: (cell: number, accent: boolean) => void;
  /** 큐가 넘쳐 버린 마디 */
  onDropped?: (id: number) => void;
}

export type Sfx = 'move' | 'rotate' | 'lock' | 'hardDrop' | 'hold' | 'sync' | 'fanfare' | 'levelUp' | 'stageClear' | 'gameOver' | 'start';

type Nodes = ReturnType<typeof buildNodes>;

function buildNodes(T: ToneNS) {
  const out = new T.Gain(1).toDestination();
  // 멜로디: Tone.Synth, triangle (§9)
  const melody = new T.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.006, decay: 0.16, sustain: 0.55, release: 0.22 },
  }).connect(out);
  melody.volume.value = -5;
  // 스테이지 1: 박수·우드블록(단일음) — MembraneSynth
  const wood = new T.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2.2,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 },
  }).connect(out);
  wood.volume.value = -3;
  // 메트로놈 -18dB
  const metroVol = new T.Volume(-18).connect(out);
  const metro = new T.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
  }).connect(metroVol);
  // 아주 짧은 클릭(이동·회전)
  const tick = new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.01 } }).connect(out);
  tick.volume.value = -24;
  // 잠금 "톡"
  const lock = new T.MembraneSynth({
    pitchDecay: 0.012,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.02 },
  }).connect(out);
  lock.volume.value = -15;
  // 당김음 글리스
  const gliss = new T.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.08, sustain: 0.6, release: 0.1 } }).connect(out);
  gliss.volume.value = -10;
  // 팡파르(패턴 첫 달성 1초, 레벨 업, 스테이지 클리어)
  const fan = new T.PolySynth(T.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.18, sustain: 0.45, release: 0.35 },
  }).connect(out);
  fan.volume.value = -11;
  // 두 음짜리 짧은 효과음(보관·시작) — 단음 신스에 미래 음을 예약하면 다음 클릭과 시각이 엇갈려 오류가 나므로 여러 목소리로
  const blip = new T.PolySynth(T.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } }).connect(out);
  blip.volume.value = -20;
  return { out, melody, wood, metroVol, metro, tick, lock, gliss, fan, blip };
}

export class RhythmAudio {
  hooks: RhythmAudioHooks = {};
  /** 설정: 메트로놈 */
  metronome = true;
  /** 스테이지 규칙: 계이름 소리(false 면 우드블록) */
  pitchSound = true;

  private T: ToneNS | null = null;
  private n: Nodes | null = null;
  private repeatId: number | null = null;
  private meter: Meter;
  private bpm = 100;
  /** 게임이 진행 중(메트로놈이 울림) */
  private clicking = false;
  private queue = new BoundedQueue<QueuedMeasure>(3);
  private playingUntil = -1;
  private disposed = false;
  private started = false;

  constructor(meter: Meter) {
    this.meter = meter;
  }

  /** Tone 이 준비되고 소리가 켜졌으면 악기를 만든다(여러 번 불러도 됨) */
  private ensure(): boolean {
    if (this.disposed) return false;
    if (this.n) return true;
    const T = getTone();
    if (!T || !isAudioUnlocked()) return false;
    this.T = T;
    this.n = buildNodes(T);
    return true;
  }

  get ready(): boolean {
    return !!this.n;
  }

  private transport() {
    return this.T!.getTransport();
  }

  private eighthTicks(): number {
    return this.transport().PPQ / 2;
  }

  /**
   * 게임 시작(또는 소리가 늦게 켜졌을 때). Transport 를 처음부터 돌리고 메트로놈 반복을 건다.
   * 반드시 소리를 켠 뒤(unlockAudio 이후)에 부른다.
   */
  begin(opts: { bpm: number; meter: Meter; pitchSound: boolean; metronome: boolean }): boolean {
    try {
      return this.beginUnsafe(opts);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[rhythm audio] begin', e);
      return false;
    }
  }

  private beginUnsafe(opts: { bpm: number; meter: Meter; pitchSound: boolean; metronome: boolean }): boolean {
    this.bpm = opts.bpm;
    this.meter = opts.meter;
    this.pitchSound = opts.pitchSound;
    this.metronome = opts.metronome;
    if (!this.ensure()) return false;
    const tr = this.transport();
    tr.stop();
    tr.cancel(0);
    this.T!.getDraw().cancel(0);
    tr.position = 0;
    tr.bpm.value = this.bpm;
    this.queue.clear();
    this.playingUntil = -1;
    this.repeatId = tr.scheduleRepeat((time) => this.onEighth(time), '8n', 0);
    tr.start('+0.05');
    this.clicking = true;
    this.started = true;
    return true;
  }

  get isStarted() {
    return this.started && !this.disposed;
  }

  pause() {
    if (!this.started || !this.T) return;
    try {
      this.transport().pause();
    } catch {
      /* 무시 */
    }
  }

  resume() {
    if (!this.started || !this.T) return;
    this.clicking = true;
    try {
      if (this.transport().state !== 'started') this.transport().start('+0.02');
    } catch {
      /* 무시 */
    }
  }

  /** 게임 오버·스테이지 클리어: 메트로놈은 멈추고, 남은 마디는 끝까지 연주 */
  finish() {
    this.clicking = false;
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
    if (this.T && this.started) this.transport().bpm.value = bpm;
  }

  setMeter(meter: Meter) {
    this.meter = meter;
  }

  /** 8분음표마다(Transport 반복 이벤트) — 메트로놈 클릭 + 연주 큐 꺼내기 */
  private onEighth(time: number) {
    try {
      this.onEighthUnsafe(time);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[rhythm audio] tick', e);
    }
  }

  private onEighthUnsafe(time: number) {
    const T = this.T;
    const n = this.n;
    if (!T || !n || this.disposed) return;
    const tr = T.getTransport();
    const E = tr.PPQ / 2;
    const idx = Math.round(tr.getTicksAtTime(time) / E);
    const W = this.meter.width;
    const cell = ((idx % W) + W) % W;
    if (this.clicking && this.meter.beatStarts.includes(cell)) {
      const accent = cell === 0;
      if (this.metronome) n.metro.triggerAttackRelease(accent ? 'A6' : 'E6', 0.03, time, accent ? 1 : 0.6);
      T.getDraw().schedule(() => this.hooks.onBeat?.(cell, accent), time);
    }
    // 다음 8분음표가 박 경계이고 지금 마디가 끝났으면 대기 중인 마디를 시작 — 끊김 없이 이어진다
    const nextIdx = idx + 1;
    const nextCell = ((nextIdx % W) + W) % W;
    if (this.queue.length && nextIdx * E >= this.playingUntil && startCells(this.meter).includes(nextCell)) {
      const m = this.queue.shift()!;
      this.scheduleMeasure(m, nextIdx * E);
    }
  }

  private scheduleMeasure(m: QueuedMeasure, startTick: number) {
    const tr = this.transport();
    const E = tr.PPQ / 2;
    const meter = getMeter(m.result.meterId);
    const W = meter.width;
    const draw = this.T!.getDraw();
    m.result.notes.forEach((note) => {
      const strong = (meter.strength[note.start] ?? 0) >= 2;
      tr.scheduleOnce((time) => this.playNote(note.pitch, note.length, time, strong), `${startTick + note.start * E}i`);
    });
    for (let c = 0; c < W; c++) {
      tr.scheduleOnce((time) => {
        draw.schedule(() => {
          if (c === 0) this.hooks.onMeasureStart?.(m.id);
          this.hooks.onCell?.(m.id, c);
        }, time);
      }, `${startTick + c * E}i`);
    }
    tr.scheduleOnce((time) => draw.schedule(() => this.hooks.onMeasureEnd?.(m.id), time), `${startTick + W * E}i`);
    this.playingUntil = startTick + W * E;
  }

  private playNote(pitch: MeasureResult['notes'][number]['pitch'], length: number, time: number, strong: boolean) {
    const n = this.n;
    if (!n || this.disposed) return;
    try {
      this.playNoteUnsafe(n, pitch, length, time, strong);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[rhythm audio] note', e);
    }
  }

  private playNoteUnsafe(n: Nodes, pitch: MeasureResult['notes'][number]['pitch'], length: number, time: number, strong: boolean) {
    const dur = eighthSeconds(this.bpm) * length;
    if (this.pitchSound) {
      // 같은 음이 이어져도 따로 들리게 끝을 조금 띄운다(케이스 2: q레 ×4)
      n.melody.triggerAttackRelease(noteName(pitch, 4), Math.max(0.06, dur * 0.86), time, strong ? 0.95 : 0.78);
    } else {
      n.wood.triggerAttackRelease(strong ? 'E5' : 'C5', 0.1, time, strong ? 1 : 0.8);
    }
  }

  /**
   * 지운 마디를 연주 큐에 넣는다(위→아래 순서로 불러야 한다).
   * 아무것도 연주 중이 아니면 첫 마디는 바로 다음 박 경계에 시작하고, 나머지는 대기열(최대 3)로.
   */
  enqueue(items: QueuedMeasure[]) {
    try {
      this.enqueueUnsafe(items);
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[rhythm audio] enqueue', e);
    }
  }

  private enqueueUnsafe(items: QueuedMeasure[]) {
    if (!this.n || !this.started || this.disposed) return;
    const tr = this.transport();
    const E = tr.PPQ / 2;
    for (const m of items) {
      const now = tr.ticks;
      if (this.queue.length === 0 && now >= this.playingUntil && tr.state === 'started') {
        const start = nextBoundaryTick(now + E / 4, this.meter, E);
        this.scheduleMeasure(m, start);
      } else {
        const dropped = this.queue.push(m);
        if (dropped) this.hooks.onDropped?.(dropped.id);
      }
    }
  }

  /** 지금 연주 중이거나 기다리는 마디가 있는가 */
  get busy(): boolean {
    if (!this.n || !this.started) return false;
    return this.queue.length > 0 || this.transport().ticks < this.playingUntil;
  }

  sfx(kind: Sfx) {
    try {
      this.sfxUnsafe(kind);
    } catch (e) {
      // 소리 하나가 실패해도 게임은 계속한다
      if (typeof console !== 'undefined') console.warn('[rhythm audio] sfx', kind, e);
    }
  }

  private sfxUnsafe(kind: Sfx) {
    const T = this.T;
    const n = this.n;
    if (!T || !n || this.disposed) return;
    const t = T.immediate();
    switch (kind) {
      case 'move':
        n.tick.triggerAttackRelease('C7', 0.02, t, 0.5);
        break;
      case 'rotate':
        n.tick.triggerAttackRelease('G6', 0.02, t, 0.6);
        break;
      case 'hold':
        n.blip.triggerAttackRelease('E6', 0.03, t, 0.7);
        n.blip.triggerAttackRelease('A6', 0.03, t + 0.05, 0.7);
        break;
      case 'lock':
        n.lock.triggerAttackRelease('G3', 0.06, t, 0.8);
        break;
      case 'hardDrop':
        n.lock.triggerAttackRelease('C3', 0.08, t, 1);
        break;
      case 'sync': {
        // 짧은 글리스(미 → 라 위로 미끄러짐)
        n.gliss.triggerAttack('E5', t, 0.7);
        n.gliss.frequency.setValueAtTime(T.Frequency('E5').toFrequency(), t);
        n.gliss.frequency.exponentialRampToValueAtTime(T.Frequency('A5').toFrequency(), t + 0.16);
        n.gliss.triggerRelease(t + 0.2);
        break;
      }
      case 'fanfare': {
        // 패턴 첫 달성 1초
        const f = n.fan;
        f.triggerAttackRelease('G4', 0.12, t);
        f.triggerAttackRelease('C5', 0.12, t + 0.12);
        f.triggerAttackRelease('E5', 0.12, t + 0.24);
        f.triggerAttackRelease(['G5', 'C6', 'E5'], 0.55, t + 0.36);
        break;
      }
      case 'levelUp': {
        const f = n.fan;
        ['C5', 'E5', 'G5', 'C6'].forEach((p, i) => f.triggerAttackRelease(p, 0.09, t + i * 0.07));
        break;
      }
      case 'stageClear': {
        const f = n.fan;
        ['C5', 'E5', 'G5'].forEach((p, i) => f.triggerAttackRelease(p, 0.14, t + i * 0.13));
        f.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], 0.9, t + 0.42);
        break;
      }
      case 'gameOver': {
        const f = n.fan;
        ['G4', 'E4', 'C4'].forEach((p, i) => f.triggerAttackRelease(p, 0.18, t + i * 0.2));
        break;
      }
      case 'start':
        n.blip.triggerAttackRelease('C6', 0.05, t, 0.8);
        n.blip.triggerAttackRelease('G6', 0.05, t + 0.08, 0.8);
        break;
    }
  }

  /** 디버그: 지금 상태 */
  debugInfo() {
    const tr = this.T?.getTransport();
    return {
      ready: this.ready,
      started: this.started,
      transport: tr?.state ?? 'none',
      bpm: tr ? Math.round(tr.bpm.value) : null,
      ticks: tr?.ticks ?? null,
      ppq: tr?.PPQ ?? null,
      playingUntil: this.playingUntil,
      waiting: this.queue.length,
      meter: this.meter.id,
      metronome: this.metronome,
      clicking: this.clicking,
    };
  }

  /** 화면을 떠날 때: Transport 를 멈추고 예약을 지우고 악기를 버린다 */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const T = this.T;
    if (!T) return;
    try {
      const tr = T.getTransport();
      if (this.repeatId !== null) tr.clear(this.repeatId);
      tr.stop();
      tr.cancel(0);
      T.getDraw().cancel(0);
    } catch {
      /* 이미 닫힌 컨텍스트 */
    }
    if (this.n) {
      for (const node of Object.values(this.n)) {
        try {
          node.dispose();
        } catch {
          /* 무시 */
        }
      }
    }
    this.n = null;
    this.queue.clear();
  }
}

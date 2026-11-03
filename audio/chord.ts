'use client';
// 화음 모드 소리 — 설계서 §9. Tone.js 는 lib/music/audio.ts 로 불러온 것(getTone)만 쓴다(정적 import 금지).
//   착지음: 그 계이름을 짧게(0.15초, 작게)
//   화음: 근음(옥타브 3) + 덩어리의 서로 다른 구성음(옥타브 4)를 PolySynth 로 0.6초. 크기 6 이상이면 근음을 옥타브 5에도. 클수록 크게.
//   연쇄: 단계마다 600~700ms 간격(연출 타임라인 그대로)으로 이어져 진행으로 들린다. 진행 보너스가 붙은 단계는 짧은 '해결' 벨.
//   동시 화음: 함께 울리되 큰 덩어리를 조금 더 크게.
//   긴장과 해결(패드): Ⅰ 을 깔고 있다가 어느 열이든 높이 10 이상이면 Ⅴ, 다시 낮아지면 Ⅰ. −24dB, 설정에서 끔.
//   모든 소리는 Transport 시각으로 예약한다(일시정지하면 Transport 도 멈춰 예약된 연쇄 소리가 함께 기다린다).
import { getTone, isAudioUnlocked, type ToneNS } from '@/lib/music/audio';
import { chordOf } from '@/lib/chord/defs';
import type { Timeline } from '@/lib/chord/chain';
import type { ChainResult, ChordId, Pitch, PopEvent } from '@/lib/chord/types';

const LETTER: Record<Pitch, string> = { 도: 'C', 레: 'D', 미: 'E', 파: 'F', 솔: 'G', 라: 'A', 시: 'B', '솔♯': 'G#' };

/** '도', 4 → 'C4' (솔♯ → 'G#4') */
export function toneName(p: Pitch, octave: number): string {
  return `${LETTER[p]}${octave}`;
}

/** §9 보이싱: 근음(옥타브 3) + 서로 다른 구성음(옥타브 4) [+ 크기 6 이상이면 근음 옥타브 5] */
export function voicing(e: Pick<PopEvent, 'chord' | 'size' | 'toneCounts'>): string[] {
  const c = chordOf(e.chord);
  const tones = c.tones.filter((t) => (e.toneCounts[t] ?? 0) > 0);
  const notes = [toneName(c.root, 3), ...tones.map((t) => toneName(t, 4))];
  if (e.size >= 6) notes.push(toneName(c.root, 5));
  return notes;
}

type Poly = InstanceType<ToneNS['PolySynth']>;
type Mono = InstanceType<ToneNS['Synth']>;
type Noise = InstanceType<ToneNS['NoiseSynth']>;

interface Nodes {
  chord: Poly;
  land: Mono;
  bell: Poly;
  pad: Poly;
  sfx: Poly;
  thud: Noise;
}

export class ChordSound {
  private nodes: Nodes | null = null;
  private padState: 'off' | 'T' | 'D' = 'off';
  private padNotes: string[] = [];
  private key: 'C' | 'a' = 'C';
  /** 설정: 긴장 패드 켬/끔(스테이지 규칙과 함께) */
  padEnabled = true;
  private tense = false;
  private running = false;

  setKey(k: 'C' | 'a') {
    this.key = k;
  }

  private tone(): ToneNS | null {
    const T = getTone();
    if (!T || !isAudioUnlocked()) return null;
    if (!this.nodes) this.build(T);
    const tr = T.getTransport();
    if (tr.state !== 'started' && this.running) tr.start();
    return T;
  }

  private build(T: ToneNS) {
    const chord = new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.55 },
    }).toDestination();
    chord.maxPolyphony = 32;
    chord.volume.value = -9;
    const land = new T.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.004, decay: 0.12, sustain: 0, release: 0.05 } }).toDestination();
    land.volume.value = -17;
    const bell = new T.PolySynth(T.FMSynth, {
      harmonicity: 3,
      modulationIndex: 7,
      envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.5 },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.2 },
    }).toDestination();
    bell.volume.value = -19;
    const pad = new T.PolySynth(T.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 1.4, decay: 0.4, sustain: 0.9, release: 1.6 },
    }).toDestination();
    pad.volume.value = -24; // §9 음량 −24dB
    const sfx = new T.PolySynth(T.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.003, decay: 0.08, sustain: 0, release: 0.05 } }).toDestination();
    sfx.volume.value = -26;
    const thud = new T.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.002, decay: 0.16, sustain: 0 } }).toDestination();
    thud.volume.value = -20;
    this.nodes = { chord, land, bell, pad, sfx, thud };
  }

  /** Transport 시각으로 예약. offsetSec 는 '지금(화면)'으로부터의 거리 */
  private at(offsetSec: number, fn: (time: number, n: Nodes) => void) {
    const T = this.tone();
    if (!T || !this.nodes) return;
    const tr = T.getTransport();
    const lookAhead = T.getContext().lookAhead;
    // transport.seconds 는 이미 lookAhead 만큼 앞선 위치라, 화면과 맞추려면 그만큼 빼되 지난 시각은 피한다
    const when = Math.max(tr.seconds + 0.005, tr.seconds - lookAhead + offsetSec);
    const n = this.nodes;
    tr.scheduleOnce((time) => fn(time, n), when);
  }

  start() {
    this.running = true;
    const T = this.tone();
    if (!T) return;
    const tr = T.getTransport();
    if (tr.state !== 'started') tr.start();
    this.applyPad();
  }

  /** 일시정지: Transport 가 멈추면 예약된 연쇄 소리도 기다린다 */
  pause() {
    const T = getTone();
    if (!T || !this.nodes) return;
    const tr = T.getTransport();
    if (tr.state === 'started') tr.pause();
    this.releasePad();
  }

  resume() {
    const T = this.tone();
    if (!T) return;
    const tr = T.getTransport();
    if (tr.state !== 'started') tr.start();
    this.applyPad();
  }

  /** 다시 하기·화면 나가기: 예약을 모두 지우고 멈춘다 */
  stop() {
    this.running = false;
    const T = getTone();
    if (!T) return;
    const tr = T.getTransport();
    tr.cancel(0);
    tr.stop();
    this.releasePad();
  }

  dispose() {
    this.stop();
    if (this.nodes) {
      for (const n of Object.values(this.nodes)) {
        try {
          n.dispose();
        } catch {
          /* 이미 정리됨 */
        }
      }
    }
    this.nodes = null;
  }

  landing(pitches: (Pitch | null)[]) {
    this.at(0, (t, n) => {
      pitches.forEach((p, i) => {
        if (p) n.land.triggerAttackRelease(toneName(p, 5), 0.15, t + i * 0.035, 0.55);
      });
      if (pitches.every((p) => !p)) n.thud.triggerAttackRelease(0.12, t);
    });
  }

  /** 연쇄 전체를 연출 타임라인대로 예약(§16 주의 2: 결과를 먼저 계산 → 순서대로 재생) */
  scheduleChain(result: ChainResult, timeline: Timeline) {
    result.steps.forEach((step, i) => {
      const at = (timeline.popAt[i] ?? 0) / 1000;
      const biggest = Math.max(...step.events.map((e) => e.size));
      this.at(at, (t, n) => {
        for (const e of step.events) {
          const vel = Math.min(0.95, 0.5 + 0.06 * (e.size - 4)) * (e.size === biggest ? 1 : 0.72);
          n.chord.triggerAttackRelease(voicing(e), 0.6, t, vel);
        }
        if (step.progressionBonus > 0) {
          const c = chordOf(step.mainChord);
          const notes = [...c.tones.slice(0, 3).map((p) => toneName(p, 6)), toneName(c.root, 7)];
          notes.forEach((nn, k) => n.bell.triggerAttackRelease(nn, 0.5, t + 0.12 + k * 0.05, 0.55));
        }
      });
    });
  }

  allClear() {
    const tonic = this.key === 'a' ? ['A4', 'C5', 'E5', 'A5', 'C6', 'E6'] : ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
    this.at(0.1, (t, n) => tonic.forEach((nn, i) => n.bell.triggerAttackRelease(nn, 0.4, t + i * 0.07, 0.6)));
  }

  newCollection() {
    this.at(0.05, (t, n) => ['E6', 'G6', 'C7'].forEach((nn, i) => n.bell.triggerAttackRelease(nn, 0.3, t + i * 0.06, 0.45)));
  }

  levelUp() {
    this.at(0, (t, n) => ['C5', 'G5'].forEach((nn, i) => n.sfx.triggerAttackRelease(nn, 0.08, t + i * 0.09, 0.5)));
  }

  rotate() {
    this.at(0, (t, n) => n.sfx.triggerAttackRelease('A5', 0.03, t, 0.25));
  }

  garbage(count: number) {
    this.at(0.12, (t, n) => {
      for (let i = 0; i < Math.min(count, 3); i++) n.thud.triggerAttackRelease(0.1, t + i * 0.05);
    });
  }

  stageClear() {
    const seq = this.key === 'a' ? ['E5', 'A5', 'C6', 'E6'] : ['G4', 'C5', 'E5', 'G5', 'C6'];
    this.at(0.05, (t, n) => {
      seq.forEach((nn, i) => n.bell.triggerAttackRelease(nn, 0.45, t + i * 0.11, 0.6));
      n.chord.triggerAttackRelease(this.key === 'a' ? ['A3', 'C4', 'E4', 'A4'] : ['C3', 'C4', 'E4', 'G4'], 1.2, t + seq.length * 0.11, 0.6);
    });
  }

  gameOver() {
    this.releasePad();
    this.at(0.05, (t, n) => ['G4', 'E4', 'C4', 'G3'].forEach((nn, i) => n.chord.triggerAttackRelease([nn], 0.35, t + i * 0.16, 0.45)));
  }

  /** 긴장(어느 열이든 높이 10 이상)이면 Ⅴ, 아니면 Ⅰ */
  setTension(tense: boolean) {
    this.tense = tense;
    this.applyPad();
  }

  setPadEnabled(on: boolean) {
    this.padEnabled = on;
    if (on) this.applyPad();
    else this.releasePad();
  }

  private padChord(state: 'T' | 'D'): string[] {
    if (this.key === 'a') return state === 'T' ? ['A2', 'C3', 'E3'] : ['G#2', 'B2', 'E3'];
    return state === 'T' ? ['C3', 'E3', 'G3'] : ['B2', 'D3', 'G3'];
  }

  private applyPad() {
    if (!this.padEnabled || !this.running) return;
    const want: 'T' | 'D' = this.tense ? 'D' : 'T';
    if (this.padState === want) return;
    const T = this.tone();
    if (!T || !this.nodes) return;
    if (T.getTransport().state !== 'started') return;
    const old = this.padNotes;
    const next = this.padChord(want);
    this.padState = want;
    this.padNotes = next;
    this.at(0, (t, n) => {
      if (old.length) n.pad.triggerRelease(old, t);
      n.pad.triggerAttack(next, t + 0.05, 0.5);
    });
  }

  /** 일시정지·끝: Transport 가 멈춰도 바로 꺼지도록 즉시 놓는다 */
  private releasePad() {
    if (!this.nodes) return;
    const T = getTone();
    if (!T) return;
    try {
      this.nodes.pad.releaseAll(T.now());
    } catch {
      /* 무시 */
    }
    this.padState = 'off';
    this.padNotes = [];
  }
}

export function chordNotesFor(chord: ChordId, size: number): string[] {
  const c = chordOf(chord);
  const counts: Partial<Record<Pitch, number>> = {};
  for (const t of c.tones) counts[t] = 1;
  return voicing({ chord, size, toneCounts: counts });
}

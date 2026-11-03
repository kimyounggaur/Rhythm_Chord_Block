// 마디 연주 큐의 순수 로직 (§9) — 소리 모듈(audio/rhythm.ts)이 Transport 시각(틱)으로 예약할 때 쓴다.
//  · 지워진 마디는 '다음 박 경계'에 맞춰 시작한다(메트로놈과 정렬).
//  · 큐에 여러 마디가 있으면 끊김 없이 이어서 연주. 큐 최대 3마디, 넘치면 가장 오래된 것을 버린다.
import { hasUniformBeats } from './meters';
import type { Meter } from './types';

/** 마디를 시작해도 되는 칸(메트로놈 주기 안의 위치). 박 길이가 모두 같으면 모든 박 시작, 7/8 처럼 섞였으면 마디 첫 칸만 */
export function startCells(meter: Meter): number[] {
  return hasUniformBeats(meter) ? meter.beatStarts.slice() : [0];
}

/**
 * fromTick 이상에서 가장 가까운 '박 경계' 틱. eighthTicks = 8분음표 하나의 틱 수(PPQ/2).
 * 메트로놈 주기 = 마디 길이(W칸)이고 틱 0 이 주기의 첫 칸이다.
 */
export function nextBoundaryTick(fromTick: number, meter: Meter, eighthTicks: number): number {
  const starts = startCells(meter);
  let idx = Math.max(0, Math.ceil(fromTick / eighthTicks - 1e-9));
  for (let guard = 0; guard < meter.width * 2 + 2; guard++, idx++) {
    const cell = ((idx % meter.width) + meter.width) % meter.width;
    if (starts.includes(cell)) return idx * eighthTicks;
  }
  return idx * eighthTicks;
}

/** 최대 길이가 정해진 대기열 — 넘치면 가장 오래된 것을 버린다 */
export class BoundedQueue<T> {
  readonly items: T[] = [];
  constructor(readonly max = 3) {}
  /** 넣고, 버려진 항목(있으면)을 돌려준다 */
  push(x: T): T | undefined {
    this.items.push(x);
    return this.items.length > this.max ? this.items.shift() : undefined;
  }
  shift(): T | undefined {
    return this.items.shift();
  }
  get length() {
    return this.items.length;
  }
  clear() {
    this.items.length = 0;
  }
}

/** 마디 하나의 길이(틱) */
export function measureTicks(meter: Meter, eighthTicks: number): number {
  return meter.width * eighthTicks;
}

/** 한 칸(8분음표)의 초. ♩=bpm */
export function eighthSeconds(bpm: number): number {
  return 30 / bpm;
}

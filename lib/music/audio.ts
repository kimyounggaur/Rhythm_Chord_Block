// 공용 오디오 초기화 — 두 설계서 §9 "첫 터치에서 Tone.start()" ("소리 켜기" 버튼), 리듬·화음 모드가 같은 모듈을 쓴다.
// Tone.js 는 브라우저 전용이라 동적 import 로만 불러온다(서버 렌더링 오류 방지, 설계서 §16 주의 1).
import { useSyncExternalStore } from 'react';

export type ToneNS = typeof import('tone');

let mod: ToneNS | null = null;
let loading: Promise<ToneNS> | null = null;
let unlocked = false;
let volume = 0.8; // 0~1
let muted = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

/** 화면이 뜰 때 미리 불러 둔다. 그래야 첫 터치 때 같은 호출 안에서 바로 start() 할 수 있다(iOS). */
export function preloadTone(): Promise<ToneNS> {
  if (mod) return Promise.resolve(mod);
  if (!loading) {
    loading = import('tone').then((m) => {
      mod = m;
      applyVolume();
      return m;
    });
  }
  return loading;
}

/** 이미 불러온 Tone 모듈(없으면 null). 소리를 낼 때는 isAudioUnlocked() 도 함께 확인한다. */
export function getTone(): ToneNS | null {
  return mod;
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

/**
 * 반드시 사용자 터치·클릭 처리 함수 안에서 부른다.
 * Tone 이 이미 불러와져 있으면 같은 호출 스택에서 바로 Tone.start() 를 불러 iOS 사파리에서도 소리가 켜진다.
 */
export function unlockAudio(): Promise<ToneNS> {
  const start = (T: ToneNS) =>
    T.start().then(() => {
      unlocked = T.getContext().state === 'running';
      applyVolume();
      emit();
      return T;
    });
  if (mod) return start(mod);
  return preloadTone().then(start);
}

/** 0~1. 0 이면 소리 끔 */
export function setMasterVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  applyVolume();
  emit();
}

export function setMuted(m: boolean) {
  muted = m;
  applyVolume();
  emit();
}

export function getAudioSettings() {
  return { volume, muted };
}

function applyVolume() {
  if (!mod) return;
  const dest = mod.getDestination();
  const silent = muted || volume <= 0.001;
  dest.mute = silent;
  if (!silent) dest.volume.value = 20 * Math.log10(volume);
}

export function subscribeAudio(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 소리가 켜졌는지(첫 터치 뒤인지) 화면에서 알고 싶을 때 */
export function useAudioUnlocked(): boolean {
  return useSyncExternalStore(subscribeAudio, isAudioUnlocked, () => false);
}

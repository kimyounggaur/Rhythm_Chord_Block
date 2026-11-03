'use client';
// 데스크톱 키보드 — 두 설계서 §5.2: ← → 이동, ↑ 또는 X 시계 회전, Z 반시계, ↓ 소프트 드롭, Space 하드 드롭, C 보관(리듬만), P 일시정지.
// 키 반복(e.repeat)은 무시하고, 반복은 HoldRepeater(DAS/ARR)가 맡는다.
import { useEffect, useRef } from 'react';

export type GameAction = 'left' | 'right' | 'rotateCW' | 'rotateCCW' | 'softDrop' | 'hardDrop' | 'hold' | 'pause';

export const DEFAULT_KEYMAP: Record<string, GameAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'rotateCW',
  KeyX: 'rotateCW',
  KeyZ: 'rotateCCW',
  ArrowDown: 'softDrop',
  Space: 'hardDrop',
  KeyC: 'hold',
  KeyP: 'pause',
  Escape: 'pause',
};

export function useKeyboard(
  onDown: (a: GameAction, e: KeyboardEvent) => void,
  onUp: (a: GameAction, e: KeyboardEvent) => void,
  enabled = true,
  keymap: Record<string, GameAction> = DEFAULT_KEYMAP,
) {
  const downRef = useRef(onDown);
  const upRef = useRef(onUp);
  downRef.current = onDown;
  upRef.current = onUp;
  useEffect(() => {
    if (!enabled) return;
    const kd = (e: KeyboardEvent) => {
      const a = keymap[e.code];
      if (!a) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      if (e.repeat) return;
      downRef.current(a, e);
    };
    const ku = (e: KeyboardEvent) => {
      const a = keymap[e.code];
      if (!a) return;
      e.preventDefault();
      upRef.current(a, e);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [enabled, keymap]);
}

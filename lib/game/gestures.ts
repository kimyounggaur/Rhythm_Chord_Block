'use client';
// 보드 제스처 — 두 설계서 §5.1
//   가로 드래그: 칸 너비의 60%마다 1칸 / 보드 탭: 시계 회전 / 두 손가락 탭: 반시계
//   아래로 드래그: 소프트 드롭(드래그하는 동안) / 아래로 빠른 플릭(800px/s 이상): 하드 드롭 / 위로 플릭: 보관(리듬만)
// 보드 요소에는 touch-action: none 을 준다(브라우저 스크롤·확대 방지).
import { useEffect, useRef, type RefObject } from 'react';

export interface GestureHandlers {
  enabled: boolean;
  /** 지금 칸 한 개의 화면 너비(px) */
  cellPx: number;
  onShift: (dir: -1 | 1) => void;
  onTap: () => void;
  onTwoFingerTap: () => void;
  onSoftDrop: (active: boolean) => void;
  onHardDrop: () => void;
  onFlickUp?: () => void;
}

const TAP_MAX_MS = 260;
const TAP_MAX_MOVE = 10;
const FLICK_PX_PER_S = 800;

interface Sample {
  t: number;
  x: number;
  y: number;
}

export function useBoardGestures(ref: RefObject<HTMLElement | null>, h: GestureHandlers) {
  const hr = useRef(h);
  hr.current = h;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.touchAction = 'none';

    let primary: number | null = null;
    let start: Sample | null = null;
    let anchorX = 0; // 가로 이동을 센 기준점
    let mode: 'none' | 'h' | 'v' = 'none';
    let soft = false;
    let samples: Sample[] = [];
    let multi = false; // 두 번째 손가락이 닿았는가
    let multiStart = 0;
    let moved = false;
    const pointers = new Set<number>();

    const reset = () => {
      if (soft) hr.current.onSoftDrop(false);
      primary = null;
      start = null;
      mode = 'none';
      soft = false;
      samples = [];
      moved = false;
    };

    const down = (e: PointerEvent) => {
      if (!hr.current.enabled) return;
      pointers.add(e.pointerId);
      if (primary === null) {
        primary = e.pointerId;
        start = { t: e.timeStamp, x: e.clientX, y: e.clientY };
        anchorX = e.clientX;
        samples = [start];
        multi = false;
        moved = false;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
      } else if (pointers.size === 2 && start && e.timeStamp - start.t < 250) {
        multi = true;
        multiStart = start.t;
      }
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== primary || !start || multi || !hr.current.enabled) return;
      const s = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      samples.push(s);
      if (samples.length > 8) samples.shift();
      const dx = s.x - start.x;
      const dy = s.y - start.y;
      if (Math.abs(dx) > TAP_MAX_MOVE || Math.abs(dy) > TAP_MAX_MOVE) moved = true;
      const cell = Math.max(8, hr.current.cellPx);
      if (mode === 'none') {
        if (Math.abs(dx) >= cell * 0.6 && Math.abs(dx) > Math.abs(dy)) mode = 'h';
        else if (dy >= cell * 0.6 && dy > Math.abs(dx) * 1.2) mode = 'v';
      }
      if (mode === 'h') {
        const step = cell * 0.6;
        while (s.x - anchorX >= step) {
          hr.current.onShift(1);
          anchorX += step;
        }
        while (anchorX - s.x >= step) {
          hr.current.onShift(-1);
          anchorX -= step;
        }
      } else if (mode === 'v') {
        const want = s.y - start.y > cell * 0.5;
        if (want !== soft) {
          soft = want;
          hr.current.onSoftDrop(want);
        }
      }
    };

    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (multi) {
        if (pointers.size === 0) {
          if (e.timeStamp - multiStart < 400 && !moved && hr.current.enabled) hr.current.onTwoFingerTap();
          multi = false;
          reset();
        }
        return;
      }
      if (e.pointerId !== primary || !start) return;
      const end = { t: e.timeStamp, x: e.clientX, y: e.clientY };
      // 최근 80ms 동안의 세로 속도
      const recent = samples.filter((p) => end.t - p.t <= 80);
      const from = recent[0] ?? samples[0] ?? start;
      const dtS = Math.max(0.001, (end.t - from.t) / 1000);
      const vy = (end.y - from.y) / dtS;
      const dyTotal = end.y - start.y;
      const cell = Math.max(8, hr.current.cellPx);
      if (hr.current.enabled) {
        if (!moved && end.t - start.t <= TAP_MAX_MS) {
          hr.current.onTap();
        } else if (mode !== 'h' && vy >= FLICK_PX_PER_S && dyTotal > cell * 0.8) {
          if (soft) {
            soft = false;
            hr.current.onSoftDrop(false);
          }
          hr.current.onHardDrop();
        } else if (mode !== 'h' && vy <= -FLICK_PX_PER_S && -dyTotal > cell * 0.8) {
          hr.current.onFlickUp?.();
        }
      }
      reset();
    };

    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (e.pointerId === primary) reset();
    };

    const noMenu = (e: Event) => e.preventDefault();

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('contextmenu', noMenu);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('contextmenu', noMenu);
    };
  }, [ref]);
}

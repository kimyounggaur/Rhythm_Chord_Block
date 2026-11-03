'use client';
// 화면 크기와 칸 크기 — 두 설계서 §13 "칸 크기 = min((화면폭 − 88) / 가로칸, 보드 영역 높이 / 세로칸)"
import { useEffect, useState } from 'react';

/** 게임 화면 기둥의 최대 너비(데스크톱에서도 휴대폰 화면처럼 보이게) */
export const MAX_COLUMN_WIDTH = 480;

export interface Viewport {
  width: number; // 게임 기둥 너비(px)
  height: number; // 보이는 높이(px)
  landscapeTouch: boolean; // 가로로 눕힌 휴대폰이면 true → "세로로 돌려 주세요"
}

function read(): Viewport {
  if (typeof window === 'undefined') return { width: 360, height: 780, landscapeTouch: false };
  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const hgt = vv?.height ?? window.innerHeight;
  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return { width: Math.min(MAX_COLUMN_WIDTH, Math.round(w)), height: Math.round(hgt), landscapeTouch: touch && w > hgt && hgt < 560 };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(() => read());
  useEffect(() => {
    const on = () => setVp(read());
    on();
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return vp;
}

/** 설계서 §13 공식 그대로. 결과는 정수 px */
export function cellSize(cols: number, rows: number, columnWidth: number, boardAreaHeight: number): number {
  return Math.max(12, Math.floor(Math.min((columnWidth - 88) / cols, boardAreaHeight / rows)));
}

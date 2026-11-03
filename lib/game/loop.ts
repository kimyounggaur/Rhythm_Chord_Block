'use client';
// 게임 루프 — 설계서 §16 주의: requestAnimationFrame 하나에서 낙하 타이머·입력·잠금 대기를 처리한다.
// 탭이 뒤로 가면(visibilitychange) 자동 일시정지.
import { useEffect, useRef } from 'react';

/** active 인 동안 매 프레임 cb(dtMs, nowMs) 를 부른다. dt 는 최대 100ms 로 자른다(탭 복귀 때 큰 점프 방지). */
export function useRafLoop(cb: (dtMs: number, nowMs: number) => void, active: boolean) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let errors = 0;
    const frame = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      try {
        cbRef.current(dt, now);
      } catch (e) {
        // 한 프레임의 오류(예: 소리 예약 시각 오류)로 게임 루프 전체가 멈추지 않게 한다
        if (errors++ < 3) console.error('[game loop]', e);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/** 탭이 가려지거나 앱이 뒤로 가면 onHidden() — 게임을 일시정지할 때 쓴다. */
export function useVisibilityPause(onHidden: () => void) {
  const ref = useRef(onHidden);
  ref.current = onHidden;
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden') ref.current();
    };
    const blur = () => ref.current();
    document.addEventListener('visibilitychange', h);
    window.addEventListener('pagehide', blur);
    return () => {
      document.removeEventListener('visibilitychange', h);
      window.removeEventListener('pagehide', blur);
    };
  }, []);
}

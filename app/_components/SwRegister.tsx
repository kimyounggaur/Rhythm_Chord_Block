'use client';
// PWA 서비스 워커 등록(홈 화면 추가 뒤 오프라인 실행) — 두 설계서 §17 M7.
// 개발 서버(next dev)에서는 등록하지 않는다(캐시 때문에 고친 코드가 안 보이는 일 방지).
import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const on = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    };
    if (document.readyState === 'complete') on();
    else window.addEventListener('load', on, { once: true });
  }, []);
  return null;
}

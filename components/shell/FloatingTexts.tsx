'use client';
// 떠오르는 점수 글자 — 두 설계서 §10 "항목별로 떠오르는 텍스트"("당김음 +50", "정격마침 +8" …).
// 무엇 때문에 점수를 받았는지 아는 것이 학습 피드백이다.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Floater {
  id: number;
  text: string;
  /** 부모 요소 안의 위치(px) */
  x: number;
  y: number;
  color?: string;
  size?: number;
  delay?: number;
}

let seq = 0;

export function useFloaters() {
  const [items, setItems] = useState<Floater[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const add = useCallback((f: Omit<Floater, 'id'>) => {
    const id = ++seq;
    setItems((s) => [...s.slice(-14), { ...f, id }]);
    timers.current.push(window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 1400 + (f.delay ?? 0)));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  return { items, add, clear };
}

export function FloatingTexts({ items }: { items: Floater[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {items.map((f) => (
        <div
          key={f.id}
          className="float-text"
          style={{ top: f.y, left: f.x, color: f.color ?? 'var(--gold)', fontSize: f.size ?? 18, animationDelay: `${f.delay ?? 0}ms` }}
        >
          {f.text}
        </div>
      ))}
    </div>
  );
}

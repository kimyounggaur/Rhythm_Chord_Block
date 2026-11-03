'use client';
// 짧은 알림(토스트, 기본 2초) — 패턴/진행 도감 첫 달성 등(리듬 §11, 화음 §11).
import { create } from 'zustand';
import { asset } from '@/lib/music/assets';

export interface ToastItem {
  id: number;
  text: string;
  sub?: string;
  icon?: string; // 에셋 경로(예: 'rhythm/badges/badge-pattern.svg')
  ms: number;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'ms'> & { ms?: number }) => void;
  remove: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (t) => {
    const id = ++seq;
    const item: ToastItem = { ms: 2000, ...t, id };
    set({ items: [...get().items.slice(-2), item] });
    setTimeout(() => get().remove(id), item.ms);
  },
  remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
}));

export function toast(text: string, opts: { sub?: string; icon?: string; ms?: number } = {}) {
  useToasts.getState().push({ text, ...opts });
}

export function ToastHost() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-2 z-40 flex flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="flex max-w-[92%] items-center gap-2 rounded-2xl border-2 border-gold bg-panel/95 px-3 py-2 text-ink shadow-[0_4px_0_rgba(0,0,0,.35)]"
          style={{ animation: 'toast-in .22s ease-out both' }}
        >
          {t.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset(t.icon)} alt="" className="h-9 w-9" />
          )}
          <div className="leading-tight">
            <div className="text-lg text-gold">{t.text}</div>
            {t.sub && <div className="text-sm text-ink-dim">{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

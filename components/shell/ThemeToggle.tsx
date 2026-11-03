'use client';
// 화면 테마 고르기 — 다크모드 · 화이트 모드 두 버튼(헤더 안에 들어가는 작은 알약 모양).
import { useEffect, useState } from 'react';
import { applyAppTheme, getAppTheme, setAppTheme, type AppTheme } from '@/lib/music/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { v: AppTheme; label: string }[] = [
  { v: 'dark', label: '다크' },
  { v: 'light', label: '화이트' },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<AppTheme>('dark');

  // 저장된 값은 브라우저에서만 읽는다(정적 내보내기 중에는 기본값으로 그린다).
  useEffect(() => {
    const saved = getAppTheme();
    applyAppTheme(saved);
    setTheme(saved);
  }, []);

  return (
    <div
      role="group"
      aria-label="화면 테마"
      className={cn('flex shrink-0 items-center gap-0.5 rounded-full border-2 border-line bg-panel/85 p-0.5', className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={theme === o.v}
          onClick={() => {
            setAppTheme(o.v);
            setTheme(o.v);
          }}
          className={cn(
            'h-8 rounded-full px-2.5 text-[14px] leading-none transition-colors',
            theme === o.v ? 'bg-gold text-ink-dark' : 'text-ink-dim',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

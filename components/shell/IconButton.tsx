'use client';
// 둥근 아이콘 버튼(일시정지·설정·소리 등) — icons/icon-*.svg 를 그대로 쓴다.
import { asset } from '@/lib/music/assets';
import { cn } from '@/lib/utils';

export function IconButton({
  icon,
  label,
  size = 44,
  onClick,
  className,
  disabled,
}: {
  /** 예: 'chord/icons/icon-pause' (확장자 없이) */
  icon: string;
  label: string;
  size?: number;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('shrink-0 rounded-full transition-transform active:scale-90 disabled:opacity-40', className)}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(`${icon}.svg`)} alt="" draggable={false} className="pointer-events-none h-full w-full" />
    </button>
  );
}

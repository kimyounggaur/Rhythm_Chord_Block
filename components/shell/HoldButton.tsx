'use client';
// 조작 버튼(◀ ▶ ⟲ ⟳ ▼ ⤓ 보관) — 누르는 동안 '-pressed' 그림으로 바뀐다(에셋 README "쓰는 법").
// 누름/뗌을 따로 알려 주므로 DAS/ARR 반복(HoldRepeater)과 소프트 드롭(누르는 동안)에 그대로 쓸 수 있다.
import { useRef, useState } from 'react';
import { asset } from '@/lib/music/assets';
import { cn } from '@/lib/utils';

export interface HoldButtonProps {
  /** 확장자와 -pressed 를 뺀 에셋 경로. 예: 'rhythm/controls/ctrl-left' */
  img: string;
  label: string;
  size: number;
  onDown: () => void;
  onUp?: () => void;
  disabled?: boolean;
  className?: string;
}

export function HoldButton({ img, label, size, onDown, onUp, disabled, className }: HoldButtonProps) {
  const [pressed, setPressed] = useState(false);
  const active = useRef(false);

  const end = () => {
    if (!active.current) return;
    active.current = false;
    setPressed(false);
    onUp?.();
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      className={cn('relative shrink-0 touch-none select-none rounded-full outline-none disabled:opacity-40', className)}
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
        active.current = true;
        setPressed(true);
        onDown();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 두 장을 겹쳐 두고 보이기만 바꾼다(첫 누름 때 그림이 늦게 뜨는 깜박임 방지) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(`${img}.svg`)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: pressed ? 0 : 1 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(`${img}-pressed.svg`)}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ opacity: pressed ? 1 : 0 }}
      />
    </button>
  );
}

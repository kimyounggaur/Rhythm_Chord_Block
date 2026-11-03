'use client';
// 조작 버튼 72px (§5.1·§13): ◀ ▶ (⟲ 설정) ⟳ ▼ ⤓ — 누르는 동안 -pressed 그림. 보관은 오른쪽 기둥의 보관 칸을 탭.
import { memo } from 'react';
import { HoldButton } from '@/components/shell/HoldButton';
import { R } from './art';

export interface ControlHandlers {
  leftDown: () => void;
  leftUp: () => void;
  rightDown: () => void;
  rightUp: () => void;
  rotateCW: () => void;
  rotateCCW: () => void;
  softDown: () => void;
  softUp: () => void;
  hardDrop: () => void;
}

export const Controls = memo(function Controls({ width, showCcw, h }: { width: number; showCcw: boolean; h: ControlHandlers }) {
  const n = showCcw ? 6 : 5;
  const size = Math.max(48, Math.min(66, Math.floor((width - 16 - (n - 1) * 6) / n)));
  return (
    <div className="flex h-[72px] items-center justify-center gap-1.5 px-2">
      <HoldButton img={R('controls/ctrl-left')} label="왼쪽" size={size} onDown={h.leftDown} onUp={h.leftUp} />
      <HoldButton img={R('controls/ctrl-right')} label="오른쪽" size={size} onDown={h.rightDown} onUp={h.rightUp} />
      <div className="w-1" />
      {showCcw && <HoldButton img={R('controls/ctrl-rotate-ccw')} label="반시계 회전" size={size} onDown={h.rotateCCW} />}
      <HoldButton img={R('controls/ctrl-rotate-cw')} label="시계 회전" size={size} onDown={h.rotateCW} />
      <HoldButton img={R('controls/ctrl-soft-drop')} label="천천히 내리기" size={size} onDown={h.softDown} onUp={h.softUp} />
      <HoldButton img={R('controls/ctrl-hard-drop')} label="한 번에 내리기" size={size} onDown={h.hardDrop} />
    </div>
  );
});

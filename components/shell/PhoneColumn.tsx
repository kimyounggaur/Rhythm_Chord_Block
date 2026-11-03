'use client';
// 화면 틀 — 휴대폰 세로 화면 기준(360×780). 데스크톱에서는 가운데 480px 기둥으로 보인다.
// 세이프 에어리어(아이폰 노치·홈 막대)를 피하고, 가로로 눕히면 "세로로 돌려 주세요"(두 설계서 §13).
import type { ReactNode } from 'react';
import { asset } from '@/lib/music/assets';
import { MAX_COLUMN_WIDTH, useViewport } from '@/lib/game/layout';

export function PhoneColumn({ children, background }: { children: ReactNode; background?: string }) {
  const vp = useViewport();
  return (
    <div className="fixed inset-0 flex justify-center overflow-hidden bg-bg">
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          maxWidth: MAX_COLUMN_WIDTH,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {background && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset(background)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="relative h-full w-full">{children}</div>
      </div>
      {vp.landscapeTouch && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-bg/95 p-6 text-center">
          <div>
            <div className="mb-3 text-5xl">📱↻</div>
            <p className="text-2xl text-ink">세로로 돌려 주세요</p>
            <p className="mt-1 text-ink-dim">이 게임은 세로 화면에서 해요</p>
          </div>
        </div>
      )}
    </div>
  );
}

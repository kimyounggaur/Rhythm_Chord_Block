'use client';
import { asset } from '@/lib/music/assets';

export function LoadingScreen({ text = '불러오는 중…' }: { text?: string }) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg text-ink">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset('chord/mascot/ttokttak-normal.svg')} alt="" className="wiggle h-28 w-auto" />
        <p className="text-xl text-ink-dim">{text}</p>
      </div>
    </div>
  );
}

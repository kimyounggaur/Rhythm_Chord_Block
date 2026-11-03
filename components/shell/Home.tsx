'use client';
// 첫 화면 — 리듬 모드 / 화음 모드 고르기. (게임 이름은 아직 미정: 두 설계서 §19-1)
import { useEffect } from 'react';
import { useNav } from '@/lib/nav';
import { preloadTone } from '@/lib/music/audio';
import { asset } from '@/lib/music/assets';
import { PhoneColumn } from './PhoneColumn';
import { SoundGate } from './SoundGate';

function ModeCard({
  title,
  sub,
  img,
  accent,
  onClick,
  href,
}: {
  title: string;
  sub: string;
  img: string;
  accent: string;
  onClick: () => void;
  href: string;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="pop-in flex w-full items-center gap-4 rounded-3xl border-[3px] bg-panel/92 p-3 pr-4 text-left shadow-[0_6px_0_rgba(0,0,0,.35)] transition-transform active:translate-y-[3px]"
      style={{ borderColor: accent }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(img)} alt="" className="h-24 w-24 shrink-0 rounded-2xl" draggable={false} />
      <div className="min-w-0">
        <div className="text-[26px] leading-tight" style={{ color: accent }}>
          {title}
        </div>
        <div className="mt-1 text-base leading-snug text-ink">{sub}</div>
      </div>
    </a>
  );
}

export default function Home() {
  const nav = useNav();
  useEffect(() => {
    preloadTone();
  }, []);
  return (
    <PhoneColumn background="chord/backgrounds/bg-title.svg">
      <div className="flex h-full flex-col items-center px-5 pb-5 pt-[max(28px,6vh)]">
        <div className="text-center">
          <h1 className="text-[40px] leading-none text-ink drop-shadow-[0_3px_0_rgba(30,20,80,.9)]">음악이론 게임</h1>
          <p className="mt-2 text-lg text-ink-dim drop-shadow-[0_2px_0_rgba(30,20,80,.9)]">블록을 쌓으며 박자와 화음을 배워요</p>
        </div>
        <div className="mt-[max(24px,5vh)] flex w-full max-w-[400px] flex-col gap-4">
          <ModeCard
            title="리듬 모드"
            sub="한 줄을 채우면 한 마디! 음표 길이·박자·당김음을 배워요"
            img="rhythm/app-icon/app-icon.svg"
            accent="#FF8FB1"
            href={nav.href('/rhythm')}
            onClick={() => nav.go('/rhythm')}
          />
          <ModeCard
            title="화음 모드"
            sub="도·미·솔이 4개 모이면 팡! 화음과 마침꼴을 배워요"
            img="chord/app-icon/app-icon.svg"
            accent="#FFC83D"
            href={nav.href('/chord')}
            onClick={() => nav.go('/chord')}
          />
        </div>
        <div className="mt-auto flex flex-col items-center gap-3">
          <SoundGate />
          <p className="text-center text-xs text-ink-dim/80">가칭 · 시험판 v0.1 · 세로 화면 · 키보드도 돼요</p>
        </div>
      </div>
    </PhoneColumn>
  );
}

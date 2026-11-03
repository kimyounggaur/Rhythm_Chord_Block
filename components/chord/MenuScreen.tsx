'use client';
// 화음 모드 시작 화면(§13: 스테이지 선택 · 무한 · 퍼즐 · 도감 · 설정)
import type { ReactNode } from 'react';
import { useNav } from '@/lib/nav';
import { IconButton } from '@/components/shell/IconButton';
import { SoundGate } from '@/components/shell/SoundGate';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { COLLECTION, PUZZLES, STAGES } from '@/lib/chord/defs';
import { useChordStore } from '@/store/chord';
import { cn } from '@/lib/utils';
import { ChordBadge, Img } from './bits';

function MenuCard({ icon, title, sub, accent, onClick, delay }: { icon: string; title: string; sub: ReactNode; accent: string; onClick: () => void; delay: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pop-in flex w-full items-center gap-3 rounded-3xl border-[3px] bg-panel/92 py-2 pl-2 pr-4 text-left shadow-[0_5px_0_rgba(0,0,0,.35)] transition-transform active:translate-y-[3px] active:shadow-none"
      style={{ borderColor: accent, animationDelay: `${delay}ms` }}
    >
      <Img path={`chord/icons/${icon}.svg`} style={{ width: 50, height: 50 }} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[23px] leading-tight" style={{ color: accent }}>
          {title}
        </span>
        <span className="block truncate text-[14px] leading-snug text-ink-dim">{sub}</span>
      </span>
      <span className="text-[26px] leading-none text-ink-dim">›</span>
    </button>
  );
}

export function MenuScreen() {
  const nav = useNav();
  const save = useChordStore((s) => s.save);
  const go = useChordStore((s) => s.go);
  const openStages = useChordStore((s) => s.openStages);
  const openSettings = useChordStore((s) => s.openSettings);
  const cleared = save.clearedStages.length;
  const collected = COLLECTION.filter((c) => (save.collections[c.id] ?? 0) > 0).length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <IconButton icon="chord/icons/icon-home" label="처음 화면" size={42} onClick={() => nav.go('/')} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <IconButton icon="chord/icons/icon-settings" label="설정" size={42} onClick={openSettings} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center px-5 pt-[max(4px,2vh)]">
        <div className="flex items-end gap-2">
          <ChordBadge chord="IV" size={44} className="wiggle" />
          <ChordBadge chord="I" size={60} />
          <ChordBadge chord="V" size={44} className="wiggle" />
        </div>
        <h1 className="mt-2 text-[44px] leading-none text-ink-art cm-text-shadow">화음 모드</h1>
        <p className="mt-2 text-center text-[17px] leading-snug text-ink-art-dim cm-text-shadow">
          도·미·솔이 4개 모이면 팡!
          <br />
          화음과 마침꼴을 배워요
        </p>
      </div>
      <div className="cm-scroll mt-[max(12px,3vh)] flex min-h-0 flex-1 flex-col items-center px-4 pb-2">
        <div className="flex w-full max-w-[400px] flex-col gap-3">
          <MenuCard icon="icon-play" title="스테이지" sub={`${cleared}/${STAGES.length} 클리어 · 으뜸화음부터 가단조까지`} accent="#FFC83D" onClick={() => openStages('campaign')} delay={0} />
          <MenuCard icon="icon-restart" title="무한 모드" sub="깬 스테이지 설정으로 끝없이" accent="#7CC8FF" onClick={() => openStages('endless')} delay={50} />
          <MenuCard
            icon="icon-hint"
            title="연쇄 퍼즐"
            sub={`${save.puzzlesSolved.length}/${PUZZLES.length} 풀었어요 · 정해진 조각으로 연쇄`}
            accent="#7FE5C4"
            onClick={() => go('puzzles')}
            delay={100}
          />
          <MenuCard icon="icon-book" title="진행 도감" sub={`${collected}/${COLLECTION.length} 모았어요`} accent="#FF8FB1" onClick={() => go('collection')} delay={150} />
        </div>
      </div>
      <div className={cn('flex shrink-0 flex-col items-center gap-2 pb-5 pt-2')}>
        <SoundGate />
      </div>
    </div>
  );
}

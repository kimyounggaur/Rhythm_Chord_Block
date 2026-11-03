'use client';
// 시작 화면(§13): 스테이지 선택(잠금·클리어 별) · 무한 모드(클리어한 박자표) · 패턴 도감 · 설정
import { useState } from 'react';
import { asset } from '@/lib/music/assets';
import { endlessMeters, STAGES, getMeter } from '@/lib/rhythm/meters';
import { allPatterns, patternKey } from '@/lib/rhythm/patterns';
import type { MeterId } from '@/lib/rhythm/types';
import { cn, formatScore } from '@/lib/utils';
import { isStageUnlocked, useRhythmSave } from '@/store/rhythm';
import { IconButton } from '@/components/shell/IconButton';
import { SoundGate } from '@/components/shell/SoundGate';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { R, stageArt } from './art';

export interface MenuProps {
  onStage: (id: number) => void;
  onEndless: (m: MeterId) => void;
  onCollection: () => void;
  onSettings: () => void;
  onHome: () => void;
}

export function MenuScreen({ onStage, onEndless, onCollection, onSettings, onHome }: MenuProps) {
  const data = useRhythmSave((s) => s.data);
  const [endlessOpen, setEndlessOpen] = useState(false);
  const meters = endlessMeters(data.clearedStages);
  const cleared = data.clearedStages.length;
  const collectionOpen = isStageUnlocked(data, 2);
  const all = allPatterns();
  const got = all.filter(({ meterId, def }) => (data.patterns[patternKey(meterId, def.id)] ?? 0) > 0).length;
  const current = STAGES.find((s) => isStageUnlocked(data, s.id) && !data.clearedStages.includes(s.id))?.id ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <IconButton icon={R('icons/icon-home')} label="처음 화면" size={42} onClick={onHome} />
        <div className="flex-1 text-center">
          <h1 className="text-[28px] leading-none text-ink drop-shadow-[0_3px_0_rgba(30,20,80,.9)]">리듬 모드</h1>
        </div>
        <IconButton icon={R('icons/icon-settings')} label="설정" size={42} onClick={onSettings} />
      </div>

      <div className="rh-scroll min-h-0 flex-1 px-3 pb-3">
        <div className="mb-3 flex items-center gap-3 rounded-3xl border-2 border-line bg-panel/85 p-2.5 pr-3 shadow-[0_4px_0_rgba(0,0,0,.35)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(R('mascot/ttokttak-happy.svg'))} alt="" className="rh-float h-[78px] w-auto shrink-0" draggable={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[19px] leading-snug text-ink">
              한 줄을 채우면 <span className="text-gold">한 마디!</span>
            </p>
            <p className="mt-0.5 text-[14px] leading-snug text-ink-dim">음표 길이·박자·당김음을 블록으로 배워요</p>
            <div className="mt-1.5">
              <SoundGate iconBase="rhythm/icons" className="py-1 text-base" />
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[20px] text-ink">스테이지</h2>
          <span className="text-[14px] text-ink-dim">
            {cleared}/{STAGES.length} 클리어
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {STAGES.map((s) => {
            const unlocked = isStageUnlocked(data, s.id);
            const done = data.clearedStages.includes(s.id);
            const best = data.stageBest[String(s.id)] ?? 0;
            const meter = s.meterSwitch ? `${s.meterId}·${s.meterSwitch.meterId}` : getMeter(s.meterId).id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!unlocked}
                onClick={() => onStage(s.id)}
                aria-label={`스테이지 ${s.id} ${s.name}${unlocked ? '' : ' (잠김)'}`}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-2xl border-[3px] bg-panel/90 text-left shadow-[0_4px_0_rgba(0,0,0,.35)] transition-transform active:translate-y-[3px] active:shadow-none',
                  done ? 'border-gold' : s.id === current ? 'rh-glow border-pink' : 'border-line',
                  !unlocked && 'cursor-not-allowed',
                )}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(stageArt(s.card.image))}
                    alt=""
                    className={cn('block aspect-[1.6] w-full', !unlocked && 'opacity-35 grayscale')}
                    draggable={false}
                  />
                  <span className="absolute left-1.5 top-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-ink-dark/85 px-1.5 text-[16px] leading-none text-gold">
                    {s.id}
                  </span>
                  {!unlocked && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset(R('icons/icon-lock.svg'))} alt="" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2" />
                  )}
                  {done && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset(R('icons/icon-star-on.svg'))} alt="클리어" className="absolute right-1 top-1 h-8 w-8 drop-shadow" />
                  )}
                </div>
                <div className="px-2 pb-1.5 pt-1">
                  <div className={cn('truncate text-[16px] leading-tight', unlocked ? 'text-ink' : 'text-ink-dim')}>{s.name}</div>
                  <div className="mt-0.5 flex items-center justify-between gap-1 text-[12px] leading-tight text-ink-dim">
                    <span className="truncate">
                      {meter} · {s.targetMeasures}마디
                    </span>
                    {best > 0 && <span className="shrink-0 text-gold/90">{formatScore(best)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 gap-2.5 border-t-2 border-line/60 bg-bg/80 px-3 pb-3 pt-2.5 backdrop-blur-sm">
        <Button variant="pink" className="h-[54px] flex-1 text-[18px]" disabled={meters.length === 0} onClick={() => setEndlessOpen(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(R(meters.length ? 'icons/icon-play.svg' : 'icons/icon-lock.svg'))} alt="" className="h-8 w-8" />
          무한 모드
        </Button>
        <Button variant="mint" className="h-[54px] flex-1 text-[18px]" disabled={!collectionOpen} onClick={onCollection}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(R(collectionOpen ? 'icons/icon-book.svg' : 'icons/icon-lock.svg'))} alt="" className="h-8 w-8" />
          <span className="flex flex-col items-start leading-none">
            패턴 도감
            <span className="mt-0.5 text-[12px] opacity-80">
              {got}/{all.length}
            </span>
          </span>
        </Button>
      </div>

      <Dialog open={endlessOpen} onOpenChange={setEndlessOpen}>
        <DialogContent className="max-w-[360px]">
          <DialogTitle>무한 모드</DialogTitle>
          <DialogDescription className="mb-3">클리어한 스테이지의 박자로 끝없이! 10마디마다 레벨이 올라요.</DialogDescription>
          <div className="grid grid-cols-2 gap-2">
            {meters.map((m) => {
              const hi = data.highScores[`endless:${m}`] ?? 0;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setEndlessOpen(false);
                    onEndless(m);
                  }}
                  className="flex flex-col items-center rounded-2xl border-2 border-line bg-bg2 px-2 py-2.5 shadow-[0_3px_0_rgba(0,0,0,.35)] transition-transform active:translate-y-[2px]"
                >
                  <span className="text-[26px] leading-none text-gold">{m}</span>
                  <span className="mt-1 text-[12px] text-ink-dim">한 마디 {getMeter(m).width}칸</span>
                  <span className="text-[12px] text-ink-dim">최고 {formatScore(hi)}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

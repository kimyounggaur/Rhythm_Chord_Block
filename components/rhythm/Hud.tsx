'use client';
// 상단 HUD 48px (§13): 점수 · 레벨 · 박자표 ♩=BPM  + 일시정지
import { memo } from 'react';
import { asset } from '@/lib/music/assets';
import { formatScore } from '@/lib/utils';
import { useRhythmView } from '@/store/rhythm';
import { IconButton } from '@/components/shell/IconButton';
import { R } from './art';

function BeatDots() {
  const meter = useRhythmView((s) => s.meter);
  const beat = useRhythmView((s) => s.beat);
  const idx = meter.beatStarts.indexOf(beat.cell);
  return (
    <div className="flex items-center justify-center gap-[3px]" aria-hidden="true">
      {meter.beatStarts.map((c, i) => (
        <span
          key={`${i}-${i === idx ? beat.n : 'x'}`}
          className={i === idx && beat.n > 0 ? 'rh-beat' : ''}
          style={{
            width: i === 0 ? 7 : 5,
            height: i === 0 ? 7 : 5,
            borderRadius: 9,
            background: i === idx && beat.n > 0 ? (i === 0 ? 'var(--gold)' : 'var(--mint)') : 'rgba(185,185,240,.35)',
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  );
}

/** ♩ (글꼴에 없는 기기가 있어 직접 그림) */
export function QuarterNote({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 12 20" width={size * 0.6} height={size} aria-hidden="true" className="mr-[1px] inline-block">
      <ellipse cx="4.6" cy="16" rx="4.2" ry="3.1" transform="rotate(-22 4.6 16)" fill="currentColor" />
      <rect x="7.6" y="1" width="1.6" height="15" rx=".8" fill="currentColor" />
    </svg>
  );
}

export const Hud = memo(function Hud({ onPause, title }: { onPause: () => void; title: string }) {
  const score = useRhythmView((s) => s.score);
  const level = useRhythmView((s) => s.level);
  const bpm = useRhythmView((s) => s.bpm);
  const meter = useRhythmView((s) => s.meter);
  return (
    <div className="flex h-12 items-center gap-1.5 px-2">
      <IconButton icon={R('icons/icon-pause')} label="일시정지" size={40} onClick={onPause} />
      <div className="flex h-10 min-w-0 flex-1 items-stretch overflow-hidden rounded-2xl border-2 border-line bg-panel/85 shadow-[0_3px_0_rgba(0,0,0,.35)]">
        <div className="flex min-w-0 flex-[1.35] flex-col justify-center px-2 leading-none">
          <span className="truncate text-[10px] text-ink-dim">{title}</span>
          <span className="text-[19px] tabular-nums text-gold" aria-label="점수">
            {formatScore(score)}
          </span>
        </div>
        <div className="my-1.5 w-px bg-line" />
        <div className="flex flex-col items-center justify-center px-2 leading-none">
          <span className="text-[10px] text-ink-dim">레벨</span>
          <span className="text-[19px] text-ink">{level}</span>
        </div>
        <div className="my-1.5 w-px bg-line" />
        <div className="flex flex-col items-center justify-center gap-[3px] px-2 leading-none">
          <span className="flex items-center gap-1 whitespace-nowrap text-[15px] text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(R('icons/icon-metronome.svg'))} alt="" className="h-4 w-4" draggable={false} />
            {meter.id}
            <span className="flex items-center text-[13px] text-ink-dim" aria-label={`4분음표 ${bpm}번`}>
              <QuarterNote />={bpm}
            </span>
          </span>
          <BeatDots />
        </div>
      </div>
    </div>
  );
});

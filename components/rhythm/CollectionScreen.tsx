'use client';
// 패턴 도감(§11·§14-5): 박자표별로 악보·이름·달성 횟수. 아직 못 모은 패턴은 ??? 로. 완성률이 진행 지표.
import { useMemo } from 'react';
import { asset } from '@/lib/music/assets';
import { getMeter } from '@/lib/rhythm/meters';
import { rhythmCaption, toNotation } from '@/lib/rhythm/notation';
import { allPatterns, patternKey, patternsFor, PATTERN_METERS, type PatternDef } from '@/lib/rhythm/patterns';
import type { MeterId, NoteEvent } from '@/lib/rhythm/types';
import { cn } from '@/lib/utils';
import { useRhythmSave } from '@/store/rhythm';
import { IconButton } from '@/components/shell/IconButton';
import { R } from './art';
import { ScoreStaff } from './score/ScoreStaff';

/** 패턴의 리듬만(계이름 없이 모두 '시' = 가운데 줄)으로 표기 */
function patternNotes(def: PatternDef): NoteEvent[] {
  let x = 0;
  return def.runs.map((len, i) => {
    const n: NoteEvent = { pitch: '시', start: x, length: len, syncopated: false, tied: false, pieceIds: [i] };
    x += len;
    return n;
  });
}

function PatternCard({ meterId, def, count, strict, staffW }: { meterId: MeterId; def: PatternDef; count: number; strict: boolean; staffW: number }) {
  const meter = getMeter(meterId);
  const notation = useMemo(() => toNotation(patternNotes(def), meter, { strictNotation: strict }), [def, meter, strict]);
  const got = count > 0;
  return (
    <div className={cn('flex items-center gap-2 rounded-2xl border-2 p-2 shadow-[0_3px_0_rgba(0,0,0,.35)]', got ? 'border-mint/70 bg-panel/90' : 'border-line/70 bg-panel/60')}>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-[17px] leading-tight', got ? 'text-ink' : 'text-ink-dim')}>{got ? def.name : '???'}</div>
        <div className="mt-0.5 text-[12px] leading-tight text-ink-dim">{got ? rhythmCaption(def.runs.map((length) => ({ length }))) : `음 ${def.runs.length}개`}</div>
        <div className="mt-1 flex items-center gap-1">
          {got ? (
            <span className="rounded-full bg-mint/20 px-2 py-0.5 text-[12px] text-mint">{count}번</span>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] text-ink-dim">아직</span>
          )}
          {def.requires === 'ties' && <span className="rounded-full bg-sky/20 px-2 py-0.5 text-[12px] text-sky">붙임줄</span>}
        </div>
      </div>
      <div className="shrink-0 overflow-hidden rounded-xl" style={{ width: staffW, height: 58, background: got ? 'linear-gradient(#fffaf0,#fff1d6)' : 'rgba(255,255,255,.06)' }}>
        {got ? (
          <ScoreStaff meter={meter} notation={notation} width={staffW} height={58} clef={false} />
        ) : (
          <div className="grid h-full place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(R('icons/icon-lock.svg'))} alt="" className="h-9 w-9 opacity-70" />
          </div>
        )}
      </div>
    </div>
  );
}

export function CollectionScreen({ onBack, width }: { onBack: () => void; width: number }) {
  const data = useRhythmSave((s) => s.data);
  const strict = data.settings.strictNotation;
  const all = allPatterns();
  const got = all.filter(({ meterId, def }) => (data.patterns[patternKey(meterId, def.id)] ?? 0) > 0).length;
  const staffW = Math.max(150, Math.min(230, Math.floor((width - 24) * 0.58)));
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-3">
        <IconButton icon={R('icons/icon-back')} label="뒤로" size={42} onClick={onBack} />
        <div className="flex-1">
          <h1 className="text-[26px] leading-none text-ink">패턴 도감</h1>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(R('badges/badge-pattern.svg'))} alt="" className="h-11 w-11" />
      </div>
      <div className="mx-3 mb-2 rounded-2xl border-2 border-line bg-panel/85 px-3 py-2 shadow-[0_3px_0_rgba(0,0,0,.35)]">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-ink">모은 패턴</span>
          <span className="text-[20px] text-mint">
            {got} <span className="text-[14px] text-ink-dim">/ {all.length}</span>
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-bg2">
          <div className="h-full rounded-full bg-mint" style={{ width: `${(got / Math.max(1, all.length)) * 100}%` }} />
        </div>
        <p className="mt-1 text-[12px] text-ink-dim">마디의 리듬이 도감과 같으면 모여요. 계이름은 상관없어요. (처음 +500, 다시 +100)</p>
      </div>
      <div className="rh-scroll min-h-0 flex-1 px-3 pb-4">
        {PATTERN_METERS.map((m) => {
          const list = patternsFor(m);
          const n = list.filter((p) => (data.patterns[patternKey(m, p.id)] ?? 0) > 0).length;
          return (
            <section key={m} className="mb-3">
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h2 className="text-[20px] text-gold">{m}</h2>
                <span className="text-[13px] text-ink-dim">
                  {n}/{list.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {list.map((def) => (
                  <PatternCard key={def.id} meterId={m} def={def} count={data.patterns[patternKey(m, def.id)] ?? 0} strict={strict} staffW={staffW} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

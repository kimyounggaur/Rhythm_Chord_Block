'use client';
// 악보 패널(§13·§14-1, M4): 최근 완성 마디 1개를 오선보로. 연주 중에는 재생 헤드가 지나간다.
// 캡션 예: "2분 · 점4분 · 8분 | 당김음 1"
import { memo, useMemo } from 'react';
import { PRIMARY_TRIADS, ROMAN } from '@/lib/music/chords';
import { getMeter } from '@/lib/rhythm/meters';
import { rhythmCaption, toNotation } from '@/lib/rhythm/notation';
import { getPattern } from '@/lib/rhythm/patterns';
import type { MeasureResult, Rules } from '@/lib/rhythm/types';
import { useRhythmView } from '@/store/rhythm';
import { ScoreStaff } from './score/ScoreStaff';

export function measureCaption(r: MeasureResult, rules: Pick<Rules, 'syncopationBonus' | 'patternBonus'>): { rhythm: string; extras: string[] } {
  const extras: string[] = [];
  if (rules.syncopationBonus && r.syncopationCount > 0) extras.push(`당김음 ${r.syncopationCount}`);
  if (r.chord) extras.push(`${ROMAN[r.chord]} 화음(${PRIMARY_TRIADS.find((t) => t.id === r.chord)!.tones.join('')})`);
  if (r.patternId && rules.patternBonus !== false) {
    const p = getPattern(r.meterId, r.patternId);
    if (p) extras.push(p.name);
  }
  return { rhythm: rhythmCaption(r.notes), extras };
}

export const ScorePanel = memo(function ScorePanel({ width, height, rules, strict }: { width: number; height: number; rules: Rules; strict: boolean }) {
  const panel = useRhythmView((s) => s.panel);
  const meterNow = useRhythmView((s) => s.meter);
  const playhead = useRhythmView((s) => s.playhead);
  const meter = panel ? getMeter(panel.result.meterId) : meterNow;
  // 스테이지 1(박수 소리·계이름 숨김)은 리듬만: 모든 음을 가운데 줄 하나에(박수는 한 음이라서)
  const rhythmOnly = !rules.pitchSound && !rules.showSolfege;
  const notation = useMemo(() => {
    if (!panel) return null;
    const n = toNotation(panel.result.notes, getMeter(panel.result.meterId), { strictNotation: strict });
    return rhythmOnly ? n.map((x) => ({ ...x, pitch: '시' as const })) : n;
  }, [panel, strict, rhythmOnly]);
  const cap = panel ? measureCaption(panel.result, rules) : null;
  const captionH = height >= 90 ? 21 : 18;
  const staffH = height - captionH - 8;
  const playCell = playhead && panel && playhead.id === panel.id ? playhead.cell : null;
  return (
    <div
      className="relative mx-2 overflow-hidden rounded-2xl border-2 border-[#e7d3ad] shadow-[0_4px_0_rgba(0,0,0,.35)]"
      style={{ height, background: 'linear-gradient(#fffaf0, #fff1d6)' }}
      aria-label="악보 패널"
    >
      <ScoreStaff meter={meter} notation={notation} width={width - 20} height={staffH} syncHighlight={rules.syncopationBonus} playCell={playCell} className="ml-1.5 mt-1" />
      <div className="absolute inset-x-2 bottom-1 flex items-center gap-1.5 overflow-hidden whitespace-nowrap leading-none" style={{ height: captionH - 2 }}>
        {cap ? (
          <>
            <span className="truncate text-[14px] text-[#33296B]">{cap.rhythm}</span>
            {cap.extras.map((x, i) => (
              <span key={i} className="shrink-0 rounded-full bg-[#ffe1b8] px-1.5 py-[2px] text-[12px] text-[#b4500a]">
                {x}
              </span>
            ))}
          </>
        ) : (
          <span className="text-[13px] text-[#5A4FA8]">한 줄을 빈칸 없이 채우면 여기에 악보가 나와요</span>
        )}
      </div>
    </div>
  );
});

'use client';
// 오선 한 줄(마디 하나)을 VexFlow 로 그린다 — 설계서 §8·§13·§14, M4.
//  높은음자리표·박자표(다장조, 조표 없음), 기 묶음(beamGroups), 붙임줄, 점음표, 당김음 강조(주황 테두리), 재생 헤드 하이라이트.
import { memo, useEffect, useRef, useState } from 'react';
import { DURATION_CELLS } from '@/lib/rhythm/notation';
import type { Meter, NotationNote } from '@/lib/rhythm/types';
import { cn } from '@/lib/utils';
import { buildMeasure, timeSigOf, timeSigParts } from './vexBuild';
import { loadVex } from './vexLoader';

export const INK = '#33296B';
export const SYNC_INK = '#E8590C';
const PLAY_INK = '#E8588A';

/** 오선을 그리는 논리 높이(맨 윗줄 20, 아랫줄 60, 가온 도 덧줄 70) */
const LOGICAL_H = 80;
const TOP_LINE = 20;

export interface ScoreStaffProps {
  meter: Meter;
  notation: readonly NotationNote[] | null;
  /** 화면 크기(px) */
  width: number;
  height: number;
  clef?: boolean;
  timeSig?: boolean;
  /** 당김음 음표를 주황 테두리로 (스테이지 3부터) */
  syncHighlight?: boolean;
  /** 재생 헤드 칸(연주 중), 없으면 null */
  playCell?: number | null;
  className?: string;
  /** 그리기를 마치면(테스트·스크린샷 대기용) */
  onDrawn?: () => void;
}

interface Drawn {
  /** 표기 음표별 SVG 요소와 x(논리 좌표) */
  els: (Element | null)[];
  xs: number[];
  scale: number;
}

function ScoreStaffImpl({ meter, notation, width, height, clef = true, timeSig = true, syncHighlight = false, playCell = null, className, onDrawn }: ScoreStaffProps) {
  const host = useRef<HTMLDivElement>(null);
  const drawn = useRef<Drawn | null>(null);
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState(false);

  // 마디가 바뀔 때만 다시 그린다(재생 헤드는 아래 효과에서 클래스만 바꾼다)
  useEffect(() => {
    let cancelled = false;
    const el = host.current;
    if (!el || width < 20 || height < 20) return;
    loadVex()
      .then((vf) => {
        if (cancelled || !host.current) return;
        el.innerHTML = '';
        const scale = height / LOGICAL_H;
        const lw = width / scale;
        const renderer = new vf.Renderer(el as HTMLDivElement, vf.Renderer.Backends.SVG);
        renderer.resize(width, height);
        const ctx = renderer.getContext();
        ctx.scale(scale, scale);
        ctx.setFillStyle(INK);
        ctx.setStrokeStyle(INK);
        // 기본 오선 위 여백은 4칸(40) — 맨 윗줄이 TOP_LINE 에 오게 y 를 올린다
        const stave = new vf.Stave(2, TOP_LINE - 40, lw - 6);
        stave.setStyle({ fillStyle: INK, strokeStyle: INK });
        if (clef) stave.addClef('treble');
        if (timeSig) stave.addTimeSignature(timeSigOf(meter));
        stave.setContext(ctx).draw();

        const els: (Element | null)[] = [];
        const xs: number[] = [];
        if (notation && notation.length) {
          const built = buildMeasure(vf, notation, meter);
          built.notes.forEach((n, i) => {
            const c = syncHighlight && notation[i].syncopated ? SYNC_INK : INK;
            n.setStyle({ fillStyle: c, strokeStyle: c });
            n.setLedgerLineStyle({ fillStyle: INK, strokeStyle: INK });
          });
          const ts = timeSigParts(meter);
          const voice = new vf.Voice({ numBeats: ts.num, beatValue: ts.den });
          voice.setMode(vf.Voice.Mode.SOFT);
          voice.addTickables(built.notes);
          new vf.Formatter().joinVoices([voice]).formatToStave([voice], stave);
          voice.draw(ctx, stave);
          built.beams.forEach((b) => {
            const all = b.getNotes().every((bn) => notation[built.notes.indexOf(bn as (typeof built.notes)[number])]?.syncopated);
            const c = syncHighlight && all ? SYNC_INK : INK;
            b.setStyle({ fillStyle: c, strokeStyle: c });
            b.setContext(ctx).draw();
          });
          built.ties.forEach((t) => {
            t.setStyle({ fillStyle: INK, strokeStyle: INK });
            t.setContext(ctx).draw();
          });
          const svg = el.querySelector('svg');
          built.notes.forEach((n, i) => {
            els.push(n.getSVGElement() ?? null);
            const bb = n.getBoundingBox();
            xs.push(n.getAbsoluteX() + (n.getNoteHeadEndX() - n.getNoteHeadBeginX()) / 2);
            // §8.4 당김음 음표는 강조색(주황 테두리)
            if (svg && syncHighlight && notation[i].syncopated && bb) {
              const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              r.setAttribute('x', String(bb.getX() - 3));
              r.setAttribute('y', String(bb.getY() - 3));
              r.setAttribute('width', String(bb.getW() + 6));
              r.setAttribute('height', String(bb.getH() + 6));
              r.setAttribute('rx', '5');
              r.setAttribute('fill', 'rgba(255,155,61,0.16)');
              r.setAttribute('stroke', SYNC_INK);
              r.setAttribute('stroke-width', '1.4');
              svg.insertBefore(r, svg.firstChild);
            }
          });
        }
        const svg = el.querySelector('svg');
        if (svg) {
          svg.style.display = 'block';
          svg.setAttribute('aria-hidden', 'true');
        }
        drawn.current = { els, xs, scale };
        setReady((v) => v + 1);
        setFailed(false);
        onDrawn?.();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // notation 은 마디가 바뀔 때만 새 배열이 온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meter, notation, width, height, clef, timeSig, syncHighlight]);

  // 재생 헤드: 칸 → 그 칸을 덮는 표기 음표를 강조
  const [barX, setBarX] = useState<number | null>(null);
  useEffect(() => {
    const d = drawn.current;
    if (!d) return;
    d.els.forEach((e) => e?.classList.remove('vf-playing'));
    if (playCell === null || playCell === undefined || !notation) {
      setBarX(null);
      return;
    }
    const idx = notation.findIndex((n) => playCell >= n.start && playCell < n.start + DURATION_CELLS[n.duration]);
    if (idx < 0) {
      setBarX(null);
      return;
    }
    d.els[idx]?.classList.add('vf-playing');
    setBarX(d.xs[idx] * d.scale);
  }, [playCell, notation, ready]);

  return (
    <div className={cn('relative', className)} style={{ width, height }}>
      <div ref={host} className="rhythm-staff absolute inset-0" />
      {barX !== null && (
        <div
          className="pointer-events-none absolute top-[6%] h-[88%] w-[18px] -translate-x-1/2 rounded-full"
          style={{ left: barX, background: 'rgba(232,88,138,0.16)', boxShadow: '0 0 0 1.5px rgba(232,88,138,0.45)' }}
        />
      )}
      {failed && <div className="absolute inset-0 grid place-items-center text-sm text-[#33296B]">악보를 불러오지 못했어요</div>}
    </div>
  );
}

export const ScoreStaff = memo(ScoreStaffImpl);

export const PLAY_COLOR = PLAY_INK;

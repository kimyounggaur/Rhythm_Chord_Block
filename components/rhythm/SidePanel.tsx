'use client';
// 보드 오른쪽 기둥(§13): 다음 조각 2개 · 보관 칸(탭하면 보관) · 마디 진행 · 콤보 · 메트로놈 친구 똑딱이 · 악보 보기
import { memo, useEffect, useRef } from 'react';
import { asset } from '@/lib/music/assets';
import { SHAPES } from '@/lib/rhythm/srs';
import { PITCH_MAP, type PieceType } from '@/lib/rhythm/types';
import { useRhythmView } from '@/store/rhythm';
import { cn } from '@/lib/utils';
import { R, tileArt } from './art';

export function MiniPiece({ type, cell, label = false, dim = false }: { type: PieceType; cell: number; label?: boolean; dim?: boolean }) {
  const cells = SHAPES[type][0];
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = (Math.max(...xs) - minX + 1) * cell;
  const h = (Math.max(...ys) - minY + 1) * cell;
  return (
    <div className="relative" style={{ width: w, height: h, opacity: dim ? 0.4 : 1, filter: dim ? 'grayscale(.6)' : undefined }}>
      {cells.map(([x, y], i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={asset(tileArt(type, label))}
          alt=""
          draggable={false}
          className="pointer-events-none absolute"
          style={{ left: (x - minX) * cell, top: (y - minY) * cell, width: cell, height: cell }}
        />
      ))}
    </div>
  );
}

function Slot({ title, children, className, onClick, ariaLabel, tall }: { title: string; children: React.ReactNode; className?: string; onClick?: () => void; ariaLabel?: string; tall: number }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onPointerDown={onClick ? (e: React.PointerEvent) => e.preventDefault() : undefined}
      className={cn(
        'flex w-full flex-col items-center rounded-2xl border-2 border-line bg-panel/85 pb-1 pt-0.5 shadow-[0_3px_0_rgba(0,0,0,.35)]',
        onClick && 'transition-transform active:translate-y-[2px] active:shadow-none',
        className,
      )}
    >
      <div className="text-[12px] leading-[16px] text-ink-dim">{title}</div>
      <div className="grid w-full flex-1 place-items-center" style={{ minHeight: tall }}>
        {children}
      </div>
    </Comp>
  );
}

export interface SidePanelProps {
  width: number;
  label: boolean;
  target: number;
  onHold: () => void;
  showRests: boolean;
  onToggleRests: () => void;
  compact: boolean;
}

export const SidePanel = memo(function SidePanel({ width, label, target, onHold, showRests, onToggleRests, compact }: SidePanelProps) {
  const next = useRhythmView((s) => s.next);
  const hold = useRhythmView((s) => s.hold);
  const holdUsed = useRhythmView((s) => s.holdUsed);
  const measures = useRhythmView((s) => s.measures);
  const combo = useRhythmView((s) => s.combo);
  const mini = Math.max(10, Math.min(16, Math.floor((width - 12) / 4)));
  const small = Math.max(8, mini - 3);
  const pct = target > 0 ? Math.min(1, measures / target) : 0;
  return (
    <div className="flex h-full flex-col items-center gap-1.5" style={{ width }}>
      <Slot title="다음" tall={mini * 2 + small * 2 + 10}>
        <div className="flex flex-col items-center gap-1.5 py-0.5">
          {next[0] && <MiniPiece type={next[0]} cell={mini} />}
          {next[1] && <MiniPiece type={next[1]} cell={small} dim />}
          {label && next[0] && <div className="text-[11px] leading-none text-ink-dim">다음 {PITCH_MAP[next[0]]}</div>}
        </div>
      </Slot>
      <Slot title="보관" tall={mini * 2 + 6} onClick={onHold} ariaLabel="보관(홀드)" className={holdUsed ? 'opacity-70' : ''}>
        {hold ? (
          <MiniPiece type={hold} cell={mini} dim={holdUsed} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset(R('controls/ctrl-hold.svg'))} alt="" className="pointer-events-none opacity-80" style={{ width: mini * 2.4, height: mini * 2.4 }} draggable={false} />
        )}
      </Slot>
      <div className="w-full rounded-2xl border-2 border-line bg-panel/85 px-1.5 py-1 text-center shadow-[0_3px_0_rgba(0,0,0,.35)]">
        <div className="text-[12px] leading-4 text-ink-dim">마디</div>
        <div className="text-[17px] leading-5 text-ink">
          {measures}
          {target > 0 && <span className="text-[12px] text-ink-dim">/{target}</span>}
        </div>
        {target > 0 && (
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg2">
            <div className="h-full rounded-full bg-mint transition-[width] duration-300" style={{ width: `${pct * 100}%` }} />
          </div>
        )}
      </div>
      {combo >= 1 && (
        <div className="pop-in flex items-center gap-1 rounded-full bg-pink px-2 py-0.5 text-[13px] text-white shadow-[0_2px_0_#c84d78]" key={combo}>
          콤보 {combo}
        </div>
      )}
      <div className="flex-1" />
      {!compact && <Mascot size={Math.min(width, 70)} />}
      <button
        type="button"
        onClick={onToggleRests}
        onPointerDown={(e) => e.preventDefault()}
        aria-pressed={showRests}
        className={cn(
          'flex w-full flex-col items-center rounded-2xl border-2 px-1 py-1 text-[11px] leading-tight shadow-[0_3px_0_rgba(0,0,0,.35)] transition-transform active:translate-y-[2px]',
          showRests ? 'border-gold bg-gold/90 text-ink-dark' : 'border-line bg-panel/85 text-ink-dim',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(R('icons/icon-book.svg'))} alt="" className="h-6 w-6" draggable={false} />
        악보 보기
      </button>
    </div>
  );
});

/** 메트로놈 친구 똑딱이 — 메트로놈 박마다 좌우로 갸웃(소리를 꺼도 움직인다) */
function Mascot({ size }: { size: number }) {
  const beat = useRhythmView((s) => s.beat);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || beat.n === 0) return;
    el.classList.toggle('l', beat.n % 2 === 0);
    el.classList.toggle('r', beat.n % 2 === 1);
  }, [beat]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={asset(R('mascot/ttokttak-normal.svg'))} alt="똑딱이" className="rh-bob pointer-events-none select-none" style={{ width: size, height: size * 1.25 }} draggable={false} />
  );
}

'use client';
// 보드(§4.1·§13): DOM 으로 그린다(§16-3). 쌓인 칸 층은 잠금·지우기 때만, 조각 층은 움직일 때만 다시 그린다.
//  · 배경: board/board-<박자>(-beats).svg (박 점선·마디 중간선·묶음 띠가 그려져 있음)
//  · 고스트: tiles/ghost-*.svg (테두리만) + 고스트 음표 미리보기(§14-3)
//  · 마디 완성 연출(§14-1, 300ms): 칸 → 알약(pills/) + 음표 기호(notes/) + 줄 빛(fx/fx-line-flash)
//  · 악보 보기(§14-7): 쌓인 줄의 빈칸을 8분쉼표로
import { forwardRef, memo, useMemo, type CSSProperties, type ReactNode, type Ref } from 'react';
import { asset } from '@/lib/music/assets';
import { activeCells } from '@/lib/rhythm/board';
import { pieceCells } from '@/lib/rhythm/srs';
import { HIDDEN_ROWS, VISIBLE_ROWS, type Board as BoardT, type PieceType } from '@/lib/rhythm/types';
import { useRhythmView } from '@/store/rhythm';
import { FloatingTexts, type Floater } from '@/components/shell/FloatingTexts';
import { boardArt, ghostArt, noteBadgeArt, pillArt, pitchTileArt, R, tileArt } from './art';
import { lengthName } from '@/lib/rhythm/notation';

export interface BoardProps {
  cell: number;
  label: boolean;
  beats: boolean;
  ghostPreview: boolean;
  ties: boolean;
  syncHighlight: boolean;
  showRests: boolean;
  floaters: Floater[];
  /** 흔들기 연출을 줄 바깥 틀(하드 드롭) */
  shakeRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

const img = (src: string, style: CSSProperties, cls = '', key?: string | number) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img key={key} src={asset(src)} alt="" draggable={false} className={`pointer-events-none absolute select-none ${cls}`} style={style} />
);

/** 쌓인 칸 — 보드가 바뀔 때만 */
const LockedLayer = memo(function LockedLayer({ cell, label }: { cell: number; label: boolean }) {
  const board = useRhythmView((s) => s.board);
  const clearing = useRhythmView((s) => s.clearing);
  const hide = useMemo(() => new Set(clearing?.rows ?? []), [clearing]);
  const out: ReactNode[] = [];
  for (let y = HIDDEN_ROWS; y < board.length; y++) {
    if (hide.has(y)) continue;
    const row = board[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!c) continue;
      out.push(img(tileArt(c.type, label), { left: x * cell, top: (y - HIDDEN_ROWS) * cell, width: cell, height: cell }, '', `${y}:${x}:${c.pieceId}`));
    }
  }
  return <>{out}</>;
});

/** 고스트 위에 놓일 음표: 각 줄에서 조각이 만드는 연속 칸 길이(붙임줄이면 옆의 같은 종류와 합침) */
function ghostNotes(board: BoardT, cells: readonly (readonly [number, number])[], type: PieceType, ties: boolean) {
  const rows = new Map<number, number[]>();
  for (const [x, y] of cells) rows.set(y, [...(rows.get(y) ?? []), x]);
  const out: { y: number; x0: number; x1: number; len: number }[] = [];
  for (const [y, xs] of rows) {
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    if (ties && board[y]) {
      while (x0 - 1 >= 0 && board[y][x0 - 1]?.type === type) x0--;
      while (x1 + 1 < board[y].length && board[y][x1 + 1]?.type === type) x1++;
    }
    out.push({ y, x0, x1, len: x1 - x0 + 1 });
  }
  return out;
}

const PieceLayer = memo(function PieceLayer({ cell, label, ghostPreview, ties }: { cell: number; label: boolean; ghostPreview: boolean; ties: boolean }) {
  const active = useRhythmView((s) => s.active);
  const ghostY = useRhythmView((s) => s.ghostY);
  const board = useRhythmView((s) => s.board);
  if (!active) return null;
  const cells = activeCells(active);
  const ghost = pieceCells(active.type, active.rotation, active.x, ghostY);
  const showGhost = ghostY !== active.y;
  const notes = ghostPreview ? ghostNotes(board, ghost, active.type, ties) : [];
  const badge = Math.max(14, Math.min(26, Math.round(cell * 0.72)));
  return (
    <>
      {showGhost &&
        ghost.map(([x, y], i) =>
          y >= HIDDEN_ROWS ? img(ghostArt(active.type), { left: x * cell, top: (y - HIDDEN_ROWS) * cell, width: cell, height: cell, opacity: 0.95 }, '', `g${i}`) : null,
        )}
      {cells.map(([x, y], i) => img(tileArt(active.type, label), { left: x * cell, top: (y - HIDDEN_ROWS) * cell, width: cell, height: cell }, '', `a${i}`))}
      {notes.map((n) => {
        if (n.y < HIDDEN_ROWS) return null;
        const src = noteBadgeArt(n.len);
        const cx = ((n.x0 + n.x1 + 1) / 2) * cell;
        const cy = (n.y - HIDDEN_ROWS + 0.5) * cell;
        return src ? (
          img(src, { left: cx - badge / 2, top: cy - badge / 2, width: badge, height: badge, opacity: 0.92, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.4))' }, '', `n${n.y}`)
        ) : (
          <div
            key={`n${n.y}`}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff6e3] px-1.5 text-[11px] leading-[16px] text-[#33296b]"
            style={{ left: cx, top: cy }}
          >
            {lengthName(n.len)}
          </div>
        );
      })}
    </>
  );
});

/** 8분쉼표(직접 그린 작은 기호) */
function EighthRest({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 20 30" width={size * 0.5} height={size * 0.75} aria-hidden="true">
      <circle cx="7" cy="9" r="3.6" fill="currentColor" />
      <path d="M7 11.5 C 10 13.5, 13.5 12.5, 15.5 8.5 L 9 27" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const RestLayer = memo(function RestLayer({ cell }: { cell: number }) {
  const board = useRhythmView((s) => s.board);
  const out: ReactNode[] = [];
  for (let y = HIDDEN_ROWS; y < board.length; y++) {
    const row = board[y];
    if (row.every((c) => c === null)) continue;
    row.forEach((c, x) => {
      if (c) return;
      out.push(
        <div
          key={`${y}:${x}`}
          className="pointer-events-none absolute grid place-items-center text-[#fff6e3]/80"
          style={{ left: x * cell, top: (y - HIDDEN_ROWS) * cell, width: cell, height: cell }}
        >
          <EighthRest size={cell} />
        </div>,
      );
    });
  }
  return <>{out}</>;
});

/** 긴 알약(5칸 이상, 붙임줄 규칙): 4칸 알약의 양 끝을 그대로 두고 가운데만 늘린다 */
function longPillStyle(src: string, cell: number): CSSProperties {
  return {
    borderStyle: 'solid',
    borderWidth: `0 ${cell}px`,
    borderImageSource: `url("${asset(src)}")`,
    borderImageSlice: '0 96 fill',
    borderImageWidth: `0 ${cell}px`,
    borderImageRepeat: 'stretch',
    boxSizing: 'border-box',
  };
}

const ClearLayer = memo(function ClearLayer({ cell, label, syncHighlight }: { cell: number; label: boolean; syncHighlight: boolean }) {
  const clearing = useRhythmView((s) => s.clearing);
  if (!clearing) return null;
  const W = clearing.meter.width;
  const badge = Math.max(22, Math.min(34, Math.round(cell * 0.95)));
  const flash = R('fx/fx-line-flash.svg');
  return (
    <div key={clearing.id} className="pointer-events-none absolute inset-0">
      {clearing.results.map((r) => {
        const top = (r.y - HIDDEN_ROWS) * cell;
        return (
          <div key={r.y}>
            <div
              className="rh-flash absolute"
              style={{ left: -8, top: top - cell * 0.2, width: W * cell + 16, height: cell * 1.4, ...longPillStyle(flash, cell * 0.9), borderImageSlice: '0 64 fill' }}
            />
            {r.notes.map((n, i) => {
              const left = n.start * cell;
              const width = n.length * cell;
              const sync = syncHighlight && n.syncopated;
              const short = n.length === 1 ? pitchTileArt(n.pitch, label) : pillArt(n.pitch, n.length, label);
              const style: CSSProperties = { left, top, width, height: cell, animationDelay: `${i * 12}ms` };
              const ring: CSSProperties = sync ? { boxShadow: '0 0 0 2.5px #FF9B3D, 0 0 10px 2px rgba(255,155,61,.7)', borderRadius: cell / 2 } : {};
              const noteSrc = noteBadgeArt(n.length);
              return (
                <div key={i}>
                  {short ? (
                    img(short, { ...style, ...ring }, 'rh-pill')
                  ) : (
                    <div className="rh-pill absolute" style={{ ...style, ...ring, ...longPillStyle(pillArt(n.pitch, 4, label)!, cell) }} />
                  )}
                  {noteSrc ? (
                    img(noteSrc, { left: left + width / 2, top: top - badge * 0.62, width: badge, height: badge, animationDelay: `${40 + i * 25}ms`, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.45))' }, 'rh-note')
                  ) : (
                    <div className="rh-note rounded-full bg-[#fff6e3] px-2 text-xs text-[#33296b]" style={{ left: left + width / 2, top: top - badge * 0.5, animationDelay: '40ms' }}>
                      {lengthName(n.length)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

export const BoardView = memo(
  forwardRef<HTMLDivElement, BoardProps>(function BoardView({ cell, label, beats, ghostPreview, ties, syncHighlight, showRests, floaters, shakeRef, children }, ref) {
    const meter = useRhythmView((s) => s.meter);
    const W = meter.width;
    const w = W * cell;
    const h = VISIBLE_ROWS * cell;
    return (
      <div ref={shakeRef} className="rh-board relative" style={{ width: w, height: h }}>
        <div
          ref={ref}
          className="relative h-full w-full overflow-hidden rounded-[10px]"
          style={{ boxShadow: '0 0 0 2px rgba(124,124,220,.55), 0 6px 0 rgba(0,0,0,.35)', touchAction: 'none' }}
        >
          {img(boardArt(meter.id, beats), { left: 0, top: 0, width: w, height: h })}
          <LockedLayer cell={cell} label={label} />
          {showRests && <RestLayer cell={cell} />}
          <PieceLayer cell={cell} label={label} ghostPreview={ghostPreview} ties={ties} />
        </div>
        <ClearLayer cell={cell} label={label} syncHighlight={syncHighlight} />
        <FloatingTexts items={floaters} />
        {children}
      </div>
    );
  }),
);

'use client';
// 보드 7×14 (설계서 §4.1·§13·§14) — DOM(CSS Grid 대신 절대 위치 + transform) 렌더링(§16 주의 4).
// 그리는 순서(에셋 README "덩어리 받침대"): ① 받침대(모든 칸) → ② 타일 → ③ 힌트 배지 → ④ 떨어지는 조각 → ⑤ 이펙트.
// 받침대: 120×120 그림의 가운데 96 이 한 칸 → s = 칸/96 배, 칸 왼쪽 위에서 (−12s, −12s).
// 힌트 배지: 38px 칸이면 지름 26, (타일x + 22, 타일y − 11) — 칸 크기에 비례.
import { memo, useMemo, type RefObject } from 'react';
import { asset } from '@/lib/music/assets';
import { haloMap, type Hint } from '@/lib/chord/hints';
import type { EngineView, TileView } from '@/lib/chord/engine';
import type { ChordId, Pitch } from '@/lib/chord/types';
import { cn } from '@/lib/utils';
import { FloatingTexts, type Floater } from '@/components/shell/FloatingTexts';
import { haloArt, tileArt } from './art';
import { ChordChip, HintBadge, Img } from './bits';

export interface FxItem {
  key: number;
  kind: 'flash' | 'shards' | 'burst' | 'ring';
  /** 보드 안 px(flash 는 칸 왼쪽 위, 나머지는 가운데) */
  x: number;
  y: number;
  size: number;
  art: string;
  delay?: number;
}

export interface ChipItem {
  key: number;
  chord: ChordId;
  size: number;
  /** 가운데 x, 위쪽 y(px) */
  x: number;
  y: number;
  delay: number;
}

const TileEl = memo(function TileEl({
  x,
  y,
  art,
  cell,
  ms,
  z,
  state,
}: {
  x: number;
  y: number;
  art: string;
  cell: number;
  ms: number;
  z: number;
  state: TileView['state'];
}) {
  return (
    <div
      className={cn('cm-tile', state === 'pop' && 'cm-popping', state === 'junk' && 'cm-junking')}
      style={{
        width: cell,
        height: cell,
        transform: `translate3d(${x * cell}px, ${(y - 1) * cell}px, 0)`,
        transition: ms > 0 ? `transform ${ms}ms linear` : 'none',
        zIndex: z,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(art)} alt="" draggable={false} />
    </div>
  );
});

const HaloEl = memo(function HaloEl({ x, y, art, cell, ms, hidden }: { x: number; y: number; art: string; cell: number; ms: number; hidden: boolean }) {
  const s = cell / 96;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset(art)}
      alt=""
      draggable={false}
      className="cm-halo"
      style={{
        width: 120 * s,
        height: 120 * s,
        transform: `translate3d(${x * cell - 12 * s}px, ${(y - 1) * cell - 12 * s}px, 0)`,
        transition: `transform ${ms}ms linear, opacity ${hidden ? 90 : 160}ms ease-out`,
        opacity: hidden ? 0 : 1,
        zIndex: 2,
      }}
    />
  );
});

export interface BoardViewProps {
  view: EngineView;
  cell: number;
  activeChords: ChordId[];
  inactive: ReadonlySet<Pitch>;
  hints: Hint[];
  fx: FxItem[];
  chips: ChipItem[];
  chain: { n: number; key: number } | null;
  floaters: Floater[];
  allClearKey: number | null;
  boardRef: RefObject<HTMLDivElement | null>;
}

export function BoardView({ view, cell, activeChords, inactive, hints, fx, chips, chain, floaters, allClearKey, boardRef }: BoardViewProps) {
  const W = cell * 7;
  const H = cell * 14;
  const peek = Math.round(cell * 0.4);
  const k = cell / 38;
  const halos = useMemo(() => haloMap(view.board, activeChords), [view.board, activeChords]);

  const boardTiles = view.tiles.filter((t) => t.layer === 'board');
  const pairTiles = view.tiles.filter((t) => t.layer === 'pair');
  const side = Math.ceil(cell * 0.3);

  return (
    <div
      ref={boardRef}
      className="relative shrink-0 touch-none select-none"
      style={{ width: W, height: H }}
      aria-label="화음 보드"
    >
      <Img path="chord/board/board-7x14.svg" className="absolute inset-0" style={{ width: W, height: H }} />
      {/* 받침대·타일·힌트·조각 — 맨 위 숨김 줄은 아래쪽 40%만 살짝 보인다 */}
      <div className="absolute inset-0" style={{ clipPath: `inset(-${peek}px -${side}px -${side}px -${side}px)` }}>
        <Img path="chord/board/mark-spawn-x.svg" className="absolute" style={{ left: 3 * cell, top: 0, width: cell, height: cell, opacity: 0.55, zIndex: 1 }} />
        {boardTiles.map((t) => {
          if (t.kind !== 'note' || t.y < 1) return null;
          const name = halos.get(`${t.x},${t.y}`);
          if (!name) return null;
          return (
            <HaloEl
              key={`h${t.id}`}
              x={t.x}
              y={t.y}
              art={haloArt(name)}
              cell={cell}
              ms={t.ms ?? view.fallMs}
              hidden={view.movingIds.has(t.id) || t.state === 'pop'}
            />
          );
        })}
        {boardTiles.map((t) => (
          <TileEl
            key={t.id}
            x={t.x}
            y={t.y}
            art={tileArt(t.pitch, t.pitch !== null && inactive.has(t.pitch))}
            cell={cell}
            ms={t.ms ?? view.fallMs}
            z={3}
            state={t.state}
          />
        ))}
        {hints.map((h, i) => {
          const [ax, ay] = h.anchor;
          const d = 26 * k;
          const left = ax === 6 ? ax * cell - 10 * k : ax * cell + 22 * k;
          return (
            <HintBadge
              key={`hint-${h.chord}-${ax}-${ay}-${i}`}
              chord={h.chord}
              missing={h.missing}
              size={d}
              className="cm-hint absolute"
              style={{ left: left - (i > 0 && hints.slice(0, i).some((o) => o.anchor[0] === ax && o.anchor[1] === ay) ? 20 * k : 0), top: (ay - 1) * cell - 11 * k, zIndex: 4 }}
            />
          );
        })}
        {pairTiles.map((t) => (
          <TileEl
            key={t.id}
            x={t.x}
            y={t.y}
            art={tileArt(t.pitch, t.pitch !== null && inactive.has(t.pitch))}
            cell={cell}
            ms={view.pairMs}
            z={5}
            state="idle"
          />
        ))}
      </div>

      {/* 이펙트 */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 6 }}>
        {fx.map((f) =>
          f.kind === 'flash' ? (
            <Img key={f.key} path={f.art} className="cm-flash absolute" style={{ left: f.x, top: f.y, width: f.size, height: f.size, animationDelay: `${f.delay ?? 0}ms` }} />
          ) : (
            <Img
              key={f.key}
              path={f.art}
              className={cn('absolute', f.kind === 'shards' && 'cm-shards', f.kind === 'burst' && 'cm-burst', f.kind === 'ring' && 'cm-ring')}
              style={{ left: f.x, top: f.y, width: f.size, height: f.size, opacity: 0, animationDelay: `${f.delay ?? 0}ms` }}
            />
          ),
        )}
        {chips.map((c) => (
          <div key={c.key} className="cm-chip flex flex-col items-center" style={{ left: c.x, top: c.y, zIndex: 7, animationDelay: `${c.delay}ms`, opacity: 0 }}>
            <ChordChip chord={c.chord} height={Math.round(cell * 0.82)} />
            <span className="-mt-0.5 rounded-full bg-[#12122f]/80 px-2 text-[13px] leading-[18px] text-ink cm-text-shadow" style={{ fontSize: Math.max(12, 0.36 * cell) }}>
              {c.size}성부
            </span>
          </div>
        ))}
        {chain && chain.n >= 2 && (
          <div key={chain.key} className="cm-chain-badge absolute" style={{ right: -cell * 0.2, top: cell * 0.3, width: cell * 1.75, height: cell * 1.75, zIndex: 8 }}>
            <Img path="chord/ui/chain-badge.svg" className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-x-0 text-center leading-none text-[#7a3b00]" style={{ top: '22%', fontSize: cell * 0.62 }}>
              {chain.n}
            </div>
          </div>
        )}
        {allClearKey !== null && (
          <div key={allClearKey} className="cm-allclear absolute left-1/2 top-[42%] flex flex-col items-center" style={{ width: W * 0.96, zIndex: 9 }}>
            <Img path="chord/ui/ribbon-allclear.svg" style={{ width: '100%', height: 'auto' }} />
            <span className="text-[22px] text-gold cm-text-shadow">+2,000</span>
          </div>
        )}
      </div>
      <FloatingTexts items={floaters} />
    </div>
  );
}

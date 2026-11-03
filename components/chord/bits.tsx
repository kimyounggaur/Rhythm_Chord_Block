'use client';
// 화음 모드 화면 조각 — 배지·칩·힌트 배지·타일·패널·머리줄
import type { CSSProperties, ReactNode } from 'react';
import { asset } from '@/lib/music/assets';
import { chordOf } from '@/lib/chord/defs';
import type { ChordId, Pitch } from '@/lib/chord/types';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/shell/IconButton';
import { CHIP_SIZE, PITCH_HEX, badgeArt, chipArt, hintArt, tileArt } from './art';

export function Img({ path, className, style, alt = '' }: { path: string; className?: string; style?: CSSProperties; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset(path)} alt={alt} draggable={false} decoding="async" className={cn('pointer-events-none select-none', className)} style={style} />;
}

/** 비율을 무시하고 늘려 그리는 그림(SVG <image preserveAspectRatio="none">). 진행 띠 바탕을 낮게 줄일 때 */
export function StretchImg({ path, width, height, className, style }: { path: string; width: number; height: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('pointer-events-none', className)} style={style} aria-hidden>
      <image href={asset(path)} x={0} y={0} width={width} height={height} preserveAspectRatio="none" />
    </svg>
  );
}

export function TileImg({ pitch, dim, size, className, style }: { pitch: Pitch | null; dim?: boolean; size: number; className?: string; style?: CSSProperties }) {
  return <Img path={tileArt(pitch, dim)} className={className} style={{ width: size, height: size, ...style }} alt={pitch ?? '방해'} />;
}

export function ChordBadge({ chord, size, className, style }: { chord: ChordId; size: number; className?: string; style?: CSSProperties }) {
  return <Img path={badgeArt(chord)} className={className} style={{ width: size, height: size, ...style }} alt={chordOf(chord).roman} />;
}

/** 화음 칩(배지 + 이름 + 구성음). 그림이 없는 가단조 화음은 같은 모양으로 만든다 */
export function ChordChip({ chord, height, className }: { chord: ChordId; height: number; className?: string }) {
  const art = chipArt(chord);
  const c = chordOf(chord);
  if (art) {
    const [w, h] = CHIP_SIZE[c.art.chip!] ?? [224, 48];
    return <Img path={art} className={className} style={{ height, width: (w / h) * height }} alt={`${c.roman} ${c.name}`} />;
  }
  const s = height / 48;
  return (
    <div
      className={cn('flex items-center rounded-full border-[3px] pr-2', className)}
      style={{ height, gap: 6 * s, paddingLeft: 2 * s, background: `linear-gradient(${c.color}ee, ${c.color}bb)`, borderColor: '#ffffffcc' }}
    >
      <ChordBadge chord={chord} size={height - 8 * s} />
      <span className="whitespace-nowrap leading-none text-white cm-text-shadow" style={{ fontSize: 19 * s }}>
        {c.name}
      </span>
      <span className="flex" style={{ gap: 2 * s }}>
        {c.tones.map((t) => (
          <TileImg key={t} pitch={t} size={26 * s} />
        ))}
      </span>
    </div>
  );
}

/** 부족한 음 힌트 배지(§14-1). 그림이 없으면(가단조의 라·레·미·솔♯) 같은 모양으로 그린다 */
export function HintBadge({ chord, missing, size, className, style }: { chord: ChordId; missing: Pitch | null; size: number; className?: string; style?: CSSProperties }) {
  const art = hintArt(chord, missing);
  if (art) return <Img path={art} className={className} style={{ width: size, height: size, ...style }} alt={missing ?? '+1'} />;
  const c = chordOf(chord);
  return (
    <div
      className={cn('grid place-items-center rounded-full', className)}
      style={{ width: size, height: size, background: c.color, boxShadow: '0 2px 0 rgba(0,0,0,.35)', ...style }}
    >
      <div
        className="grid place-items-center rounded-full text-white"
        style={{ width: size * 0.74, height: size * 0.74, background: missing ? PITCH_HEX[missing] : '#fff', fontSize: size * (missing === '솔♯' ? 0.3 : 0.4), color: missing ? '#fff' : '#33296b', lineHeight: 1 }}
      >
        {missing ?? '+1'}
      </div>
    </div>
  );
}

export function Panel({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn('rounded-3xl border-2 border-line bg-panel/92 shadow-[0_5px_0_rgba(0,0,0,.35)]', className)} style={style}>
      {children}
    </div>
  );
}

/** 메뉴 화면 머리줄: 뒤로 · 제목 · 오른쪽 */
export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 px-3">
      <IconButton icon="chord/icons/icon-back" label="뒤로" size={42} onClick={onBack} />
      <h1 className="min-w-0 flex-1 truncate text-[26px] leading-none text-ink cm-text-shadow">{title}</h1>
      {right}
    </div>
  );
}

/** 로마 숫자 진행 "Ⅳ → Ⅴ → Ⅰ" */
export function romanArrow(seq: ChordId[]): string {
  return seq.map((id) => chordOf(id).roman).join(' → ');
}

export function tonesText(chord: ChordId): string {
  return chordOf(chord).tones.join('·');
}

'use client';
// 게임 화면 조각 — 상단 HUD(48) · 진행 띠(64) · 오른쪽 열(다음·음정·목표) · 조작 버튼 줄(72)  (설계서 §13)
import type { ReactNode } from 'react';
import { formatScore, cn } from '@/lib/utils';
import { HoldButton } from '@/components/shell/HoldButton';
import { IconButton } from '@/components/shell/IconButton';
import { goalShort, type GoalProgress } from '@/lib/chord/goals';
import type { Goal } from '@/lib/chord/types';
import { RText } from './Roman';
import type { StripInfo } from '@/lib/chord/strip';
import { pairInterval } from '@/lib/chord/interval';
import type { ActivePair, Pitch } from '@/lib/chord/types';
import { intervalArt } from './art';
import { ChordBadge, Img, StretchImg, TileImg } from './bits';

// ───────────────────────── HUD

function Stat({ label, value, grow, accent }: { label: string; value: ReactNode; grow?: boolean; accent?: boolean }) {
  return (
    <div className={cn('flex h-[40px] flex-col justify-center rounded-2xl border-2 border-line/80 bg-panel/88 px-2.5 leading-none', grow ? 'min-w-0 flex-1' : 'shrink-0')}>
      <span className="text-[11px] text-ink-dim">{label}</span>
      <span className={cn('mt-[3px] truncate text-[19px]', accent ? 'text-gold' : 'text-ink')}>{value}</span>
    </div>
  );
}

export function Hud({
  score,
  level,
  maxChain,
  puzzleLeft,
  onPause,
  soundOn,
  onToggleSound,
}: {
  score: number;
  level: number;
  maxChain: number;
  puzzleLeft: number | null;
  onPause: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 px-2">
      <IconButton icon="chord/icons/icon-pause" label="일시정지" size={40} onClick={onPause} />
      <Stat label="점수" value={formatScore(score)} grow accent />
      {puzzleLeft === null ? <Stat label="레벨" value={level} /> : <Stat label="남은 조각" value={puzzleLeft} />}
      <Stat label="연쇄 최고" value={maxChain} />
      <IconButton icon={soundOn ? 'chord/icons/icon-sound-on' : 'chord/icons/icon-sound-off'} label={soundOn ? '소리 끄기' : '소리 켜기'} size={36} onClick={onToggleSound} />
    </div>
  );
}

// ───────────────────────── 진행 띠

export function StripZone({
  strip,
  stripKey,
  idle,
  width,
}: {
  strip: StripInfo | null;
  stripKey: number;
  idle: ReactNode;
  width: number;
}) {
  const w = Math.min(width - 12, 400);
  if (!strip) return <div className="flex h-16 shrink-0 items-center justify-center px-2">{idle}</div>;
  const two = !!strip.reverseHint;
  const stripH = two ? 30 : Math.round((w * 56) / 352);
  const n = strip.chords.length;
  const shown = n > 7 ? strip.chords.slice(n - 7) : strip.chords;
  const textW = strip.title.length > 5 ? 112 : 96;
  const avail = w - textW - 24;
  const badge = Math.max(18, Math.min(two ? 24 : 38, Math.floor(avail / (shown.length + (shown.length - 1) * 0.62))));
  const arrowW = Math.round(badge * 0.62);
  return (
    <div className="flex h-16 shrink-0 flex-col items-center justify-center" key={stripKey}>
      <div className="cm-strip-in relative" style={{ width: w, height: stripH }}>
        <StretchImg path={strip.gold ? 'chord/ui/strip-bg-gold.svg' : 'chord/ui/strip-bg.svg'} width={w} height={stripH} className="absolute inset-0" />
        <div className="absolute inset-0 flex items-center gap-1 pl-3 pr-3">
          <div className="flex min-w-0 flex-1 items-center">
            {n > shown.length && <span className="mr-0.5 text-ink-dim">…</span>}
            {shown.map((c, i) => (
              <span key={i} className="flex items-center">
                {i > 0 && <Img path="chord/ui/strip-arrow.svg" style={{ width: arrowW, height: (arrowW * 32) / 48, margin: '0 1px' }} />}
                <ChordBadge chord={c} size={badge} className="cm-strip-badge" style={{ animationDelay: `${i * 70}ms` }} />
              </span>
            ))}
          </div>
          <div className="flex shrink-0 flex-col items-end justify-center leading-none" style={{ maxWidth: textW + 20 }}>
            <span className={cn('whitespace-nowrap', two ? 'text-[15px]' : 'text-[18px]', strip.gold ? 'text-gold' : 'text-ink')}>
              {strip.title}
              {strip.bonus ? <span className="ml-1 text-gold">+{strip.bonus}</span> : null}
            </span>
            {!two && strip.sub && <span className="mt-1 max-w-[150px] truncate text-[11px] text-ink-dim">{strip.sub}</span>}
          </div>
        </div>
      </div>
      {two && (
        <div className="cm-hintbar relative mt-1" style={{ width: w, height: Math.round((w * 36) / 352) }}>
          <Img path="chord/ui/hint-bar.svg" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-y-0 left-[13%] right-2 flex items-center text-[14px] leading-none text-ink">
            <RText text={strip.reverseHint!} />
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── 오른쪽 열

export function NextPanel({ pairs, inactive }: { pairs: [Pitch, Pitch][]; inactive: ReadonlySet<Pitch> }) {
  const [a, b] = pairs;
  return (
    <div className="relative" style={{ width: 72, height: 156 }} aria-label="다음 조각">
      <Img path="chord/ui/panel-next.svg" className="absolute inset-0" style={{ width: 72, height: 156 }} />
      {a && (
        <>
          <TileImg pitch={a[1]} dim={inactive.has(a[1])} size={28} className="absolute" style={{ left: 22, top: 31 }} />
          <TileImg pitch={a[0]} dim={inactive.has(a[0])} size={28} className="absolute" style={{ left: 22, top: 59 }} />
        </>
      )}
      {b && (
        <>
          <TileImg pitch={b[1]} dim={inactive.has(b[1])} size={21} className="absolute" style={{ left: 25.5, top: 103 }} />
          <TileImg pitch={b[0]} dim={inactive.has(b[0])} size={21} className="absolute" style={{ left: 25.5, top: 124 }} />
        </>
      )}
    </div>
  );
}

export function IntervalPanel({ pair, pairKey }: { pair: ActivePair | null; pairKey: string }) {
  const iv = pair ? pairInterval(pair) : null;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 72, height: 64 }} aria-label={iv ? `음정 ${iv.label}` : '음정'} title={iv ? iv.label : undefined}>
        <Img path="chord/ui/panel-interval.svg" className="absolute inset-0" style={{ width: 72, height: 64 }} />
        {iv && <Img key={`${pairKey}-${iv.n}`} path={intervalArt(iv.n)} className="cm-interval-pop absolute" style={{ left: 8, top: 27.5, width: 56, height: 28 }} />}
      </div>
      <div className="mt-0.5 h-4 text-center text-[12px] leading-4 text-ink-dim">{iv ? `${iv.lower}→${iv.upper}${iv.n === 1 ? ' 같은 음' : ''}` : ''}</div>
    </div>
  );
}

export function GoalPanel({ goals, title, lines }: { goals: GoalProgress[]; title: string; lines?: ReactNode }) {
  return (
    <div className="w-[72px] rounded-2xl border-2 border-line/80 bg-panel/88 px-1.5 pb-1.5 pt-1 text-center">
      <div className="text-[12px] leading-4 text-ink-dim">{title}</div>
      {goals.map((g, i) => {
        const wide = (g.goal.progression?.length ?? 0) >= 2;
        const count = (
          <span>
            {Math.min(g.value, g.goal.count)}/{g.goal.count}
          </span>
        );
        return (
        <div key={i} className="mt-1">
          {wide ? (
            <div className={cn('text-[12px] leading-4', g.done ? 'text-mint' : 'text-ink')}>
              <div className="flex justify-center">
                <GoalLabel goal={g.goal} />
              </div>
              <div className="mt-0.5 flex justify-end">{count}</div>
            </div>
          ) : (
            <div className={cn('flex items-center justify-between text-[12px] leading-4', g.done ? 'text-mint' : 'text-ink')}>
              <GoalLabel goal={g.goal} />
              {count}
            </div>
          )}
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-bg2">
            <div className={cn('h-full rounded-full transition-[width] duration-300', g.done ? 'bg-mint' : 'bg-gold')} style={{ width: `${Math.min(100, (g.value / g.goal.count) * 100)}%` }} />
          </div>
        </div>
        );
      })}
      {lines}
    </div>
  );
}

/** 옆 패널 목표 이름: 화음은 배지로(로마 숫자 글자가 작으면 알아보기 어렵다) */
function GoalLabel({ goal }: { goal: Goal }) {
  if (goal.type === 'chordPops' && goal.chord) return <ChordBadge chord={goal.chord} size={18} />;
  if ((goal.type === 'cadence' || goal.type === 'progression') && goal.progression) {
    const n = goal.progression.length;
    const s = n > 3 ? 12 : n > 2 ? 15 : 17;
    return (
      <span className="flex items-center">
        {goal.progression.map((c, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <span className="text-[9px] text-ink-dim">›</span>}
            <ChordBadge chord={c} size={s} />
          </span>
        ))}
      </span>
    );
  }
  return <span className="truncate">{goalShort(goal)}</span>;
}

export function Mascot({ mood, size = 72 }: { mood: 'normal' | 'happy' | 'oops'; size?: number }) {
  const path = mood === 'happy' ? 'chord/mascot/ttokttak-happy.svg' : mood === 'oops' ? 'chord/mascot/ttokttak-oops.svg' : 'chord/mascot/ttokttak-normal.svg';
  return <Img key={mood} path={path} className={mood === 'happy' ? 'cm-mascot-happy' : 'cm-mascot'} style={{ width: size, height: (size * 300) / 240 }} />;
}

// ───────────────────────── 조작 버튼(§5.1)

export type ControlAction = 'left' | 'right' | 'ccw' | 'cw' | 'soft' | 'hard';

export function Controls({ width, onDown, onUp, disabled }: { width: number; onDown: (a: ControlAction) => void; onUp: (a: ControlAction) => void; disabled?: boolean }) {
  const size = Math.max(40, Math.min(60, Math.floor((width - 16 - 40) / 6)));
  const btn = (a: ControlAction, img: string, label: string) => (
    <HoldButton img={`chord/controls/${img}`} label={label} size={size} onDown={() => onDown(a)} onUp={() => onUp(a)} disabled={disabled} />
  );
  return (
    <div className="flex h-[72px] shrink-0 items-center justify-center px-2" style={{ gap: 4 }}>
      {btn('left', 'ctrl-left', '왼쪽')}
      {btn('right', 'ctrl-right', '오른쪽')}
      <span style={{ width: 10 }} />
      {btn('ccw', 'ctrl-rotate-ccw', '반시계 회전')}
      {btn('cw', 'ctrl-rotate-cw', '시계 회전')}
      <span style={{ width: 10 }} />
      {btn('soft', 'ctrl-soft-drop', '천천히 내리기')}
      {btn('hard', 'ctrl-hard-drop', '한 번에 내리기')}
    </div>
  );
}

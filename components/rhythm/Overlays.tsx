'use client';
// 게임 위에 뜨는 화면들: 스테이지 시작 카드(§14-4), 박자 바뀜 카드(스테이지 10), 일시정지, 스테이지 클리어·게임 오버 요약(§14-6)
import { useMemo, useRef, type ReactNode } from 'react';
import { asset } from '@/lib/music/assets';
import { getMeter } from '@/lib/rhythm/meters';
import { DURATION_NAME, toNotation } from '@/lib/rhythm/notation';
import { patternFromKey } from '@/lib/rhythm/patterns';
import type { Duration, MeasureResult, Meter, Rules, RunStats, StageConfig } from '@/lib/rhythm/types';
import { formatScore, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { R, stageArt } from './art';
import { ScoreStaff } from './score/ScoreStaff';
import { measureCaption } from './ScorePanel';
import { useElementSize } from './useElementSize';

function Scrim({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('absolute inset-0 z-40 flex items-center justify-center bg-[#0b0b24]/72 p-3 backdrop-blur-[2px]', className)}>{children}</div>
  );
}

function Chip({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'gold' | 'mint' | 'pink' | 'sky' }) {
  const tones = {
    dim: 'bg-white/10 text-ink',
    gold: 'bg-gold/20 text-gold',
    mint: 'bg-mint/20 text-mint',
    pink: 'bg-pink/20 text-pink',
    sky: 'bg-sky/20 text-sky',
  } as const;
  return <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] leading-none', tones[tone])}>{children}</span>;
}

export function ruleChips(rules: Rules): { text: string; tone: 'dim' | 'gold' | 'mint' | 'pink' | 'sky' }[] {
  const out: { text: string; tone: 'dim' | 'gold' | 'mint' | 'pink' | 'sky' }[] = [];
  if (!rules.pitchSound) out.push({ text: '박수 소리', tone: 'sky' });
  if (!rules.showSolfege) out.push({ text: '계이름 숨김', tone: 'dim' });
  if (rules.pitchSound) out.push({ text: '계이름 멜로디', tone: 'sky' });
  if (rules.beatColoring) out.push({ text: '박 번호', tone: 'dim' });
  if (rules.syncopationBonus) out.push({ text: '당김음 보너스', tone: 'gold' });
  if (rules.chordBonus) out.push({ text: '화음 보너스', tone: 'pink' });
  if (rules.ties) out.push({ text: '붙임줄', tone: 'mint' });
  if (rules.patternBonus !== false) out.push({ text: '패턴 도감', tone: 'mint' });
  return out;
}

export function StageCard({ stage, mode, onStart, onBack }: { stage: StageConfig; mode: 'campaign' | 'endless'; onStart: () => void; onBack: () => void }) {
  const meter = getMeter(stage.meterId);
  return (
    <Scrim>
      <div className="rh-card-in w-full max-w-[380px] rounded-3xl border-2 border-line bg-panel p-4 text-center shadow-[0_8px_0_rgba(0,0,0,.4)]">
        <div className="text-[15px] text-ink-dim">{mode === 'campaign' ? `스테이지 ${stage.id}` : '무한 모드'}</div>
        <h2 className="mt-0.5 text-[28px] leading-tight text-gold">{mode === 'campaign' ? stage.name : `${stage.meterId} 무한 연습`}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(stageArt(stage.card.image))} alt="" className="mx-auto mt-3 w-full max-w-[300px] rounded-2xl" draggable={false} />
        <p className="mt-3 text-[18px] leading-snug text-ink">{stage.card.text}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <Chip tone="gold">
            {stage.meterSwitch ? `${stage.meterId} → ${stage.meterSwitch.meterId}` : `${meter.id} · 한 마디 ${meter.width}칸`}
          </Chip>
          {mode === 'campaign' ? <Chip tone="mint">목표 {stage.targetMeasures}마디</Chip> : <Chip tone="mint">목표 없음</Chip>}
          <Chip>레벨 {stage.startLevel}부터</Chip>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {ruleChips(stage.rules).map((c) => (
            <Chip key={c.text} tone={c.tone}>
              {c.text}
            </Chip>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onBack}>
            뒤로
          </Button>
          <Button size="lg" className="flex-[2]" onClick={onStart} autoFocus>
            시작
          </Button>
        </div>
        <p className="mt-2 text-[12px] text-ink-dim">키보드: ← → 이동 · ↑ 회전 · ↓ 내리기 · Space 떨어뜨리기 · C 보관 · P 멈춤</p>
      </div>
    </Scrim>
  );
}

export function MeterCard({ meter, text, onContinue }: { meter: Meter; text: string; onContinue: () => void }) {
  return (
    <Scrim>
      <div className="rh-card-in w-full max-w-[360px] rounded-3xl border-2 border-gold bg-panel p-4 text-center shadow-[0_8px_0_rgba(0,0,0,.4)]">
        <div className="text-[15px] text-ink-dim">박자가 바뀌어요</div>
        <h2 className="mt-0.5 text-[34px] leading-tight text-gold">{meter.id}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(stageArt('stage10.svg'))} alt="" className="mx-auto mt-2 w-full max-w-[280px] rounded-2xl" draggable={false} />
        <p className="mt-3 text-[18px] leading-snug text-ink">{text}</p>
        <Button size="lg" className="mt-4 w-full" onClick={onContinue} autoFocus>
          계속
        </Button>
      </div>
    </Scrim>
  );
}

export function PauseDialog({
  open,
  onResume,
  onRestart,
  onSettings,
  onMenu,
  onHome,
}: {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onMenu: () => void;
  onHome: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onResume()}>
      <DialogContent hideClose className="max-w-[340px] text-center">
        <DialogTitle className="flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(R('icons/icon-pause.svg'))} alt="" className="h-9 w-9" />
          잠깐 멈춤
        </DialogTitle>
        <DialogDescription className="mb-4">준비되면 계속해요. (P 키로도 멈추고 이어 해요)</DialogDescription>
        <div className="flex flex-col gap-2.5">
          <Button size="lg" onClick={onResume} autoFocus>
            계속하기
          </Button>
          <Button variant="sky" onClick={onRestart}>
            다시 하기
          </Button>
          <Button variant="secondary" onClick={onSettings}>
            설정
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onMenu}>
              스테이지 고르기
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onHome}>
              처음 화면
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface SummaryData {
  kind: 'stageClear' | 'gameOver';
  mode: 'campaign' | 'endless';
  stage: StageConfig;
  score: number;
  level: number;
  stats: RunStats;
  rules: Rules;
  newHigh: boolean;
  firstClear: boolean;
  hasNext: boolean;
}

const DURS: Duration[] = ['8', 'q', 'qd', 'h', 'hd', 'w'];
const DUR_BADGE: Record<Duration, string> = { '8': 'e', q: 'q', qd: 'qd', h: 'h', hd: 'hd', w: 'w' };

function Stat({ label, value, tone = 'text-ink' }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-bg2/80 px-2 py-1.5">
      <span className="text-[12px] text-ink-dim">{label}</span>
      <span className={cn('text-[22px] leading-tight', tone)}>{value}</span>
    </div>
  );
}

function BestMeasure({ m, rules, strict }: { m: MeasureResult; rules: Rules; strict: boolean }) {
  const meter = getMeter(m.meterId);
  const rhythmOnly = !rules.pitchSound && !rules.showSolfege;
  const notation = useMemo(() => {
    const n = toNotation(m.notes, meter, { strictNotation: strict });
    return rhythmOnly ? n.map((x) => ({ ...x, pitch: '시' as const })) : n;
  }, [m, meter, strict, rhythmOnly]);
  const cap = measureCaption(m, rules);
  const box = useRef<HTMLDivElement>(null);
  const { w } = useElementSize(box);
  return (
    <div ref={box} className="rounded-2xl border-2 border-[#e7d3ad] p-1.5" style={{ background: 'linear-gradient(#fffaf0, #fff1d6)' }}>
      {w > 0 && <ScoreStaff meter={meter} notation={notation} width={w - 16} height={70} syncHighlight={rules.syncopationBonus} />}
      <div className="flex flex-wrap items-center gap-1 px-1 pb-0.5 text-[13px] text-[#33296B]">
        <span>{cap.rhythm}</span>
        {cap.extras.map((x) => (
          <span key={x} className="rounded-full bg-[#ffe1b8] px-1.5 text-[12px] text-[#b4500a]">
            {x}
          </span>
        ))}
        <span className="ml-auto text-[#b4500a]">+{formatScore(m.score)}</span>
      </div>
    </div>
  );
}

export function Summary({
  data,
  strict,
  onNext,
  onRetry,
  onMenu,
}: {
  data: SummaryData;
  strict: boolean;
  onNext: () => void;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const s = data.stats;
  const clear = data.kind === 'stageClear';
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#0b0b24]/80 backdrop-blur-[3px]">
      {clear && <Confetti />}
      <div className="rh-scroll flex-1 px-3 pb-3 pt-4">
        <div className="rh-card-in mx-auto w-full max-w-[400px] rounded-3xl border-2 border-line bg-panel p-3.5 shadow-[0_8px_0_rgba(0,0,0,.4)]">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(R(`mascot/ttokttak-${clear ? 'happy' : 'oops'}.svg`))} alt="" className={cn('h-[92px] w-auto', clear && 'rh-float')} draggable={false} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-ink-dim">
                {data.mode === 'campaign' ? `스테이지 ${data.stage.id} · ${data.stage.name}` : `무한 모드 · ${data.stage.meterId}`}
              </div>
              <h2 className={cn('text-[30px] leading-tight', clear ? 'text-gold' : 'text-pink')}>{clear ? '스테이지 클리어!' : '게임 오버'}</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] tabular-nums text-ink">{formatScore(data.score)}</span>
                <span className="text-[14px] text-ink-dim">점</span>
                {data.newHigh && data.score > 0 && <span className="rh-glow rounded-full bg-gold px-2 py-0.5 text-[13px] text-ink-dark">최고 기록!</span>}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <Stat label="완성 마디" value={s.measures} tone="text-mint" />
            <Stat label="최고 콤보" value={Math.max(0, s.maxCombo)} tone="text-pink" />
            <Stat label="당김음" value={data.rules.syncopationBonus ? s.syncopations : '–'} tone="text-gold" />
            <Stat label="화음 마디" value={data.rules.chordBonus ? s.chordMeasures : '–'} tone="text-lav" />
          </div>

          <div className="mt-3 text-[14px] text-ink-dim">음표 종류별 개수</div>
          <div className="mt-1 grid grid-cols-6 gap-1">
            {DURS.map((d) => (
              <div key={d} className={cn('flex flex-col items-center rounded-xl bg-bg2/80 py-1', s.notesByDuration[d] === 0 && 'opacity-40')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(R(`notes/note-${DUR_BADGE[d]}.svg`))} alt={DURATION_NAME[d]} className="h-8 w-8" draggable={false} />
                <span className="text-[11px] leading-tight text-ink-dim">{DURATION_NAME[d]}</span>
                <span className="text-[16px] leading-tight text-ink">{s.notesByDuration[d]}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[14px] text-ink-dim">새로 등록한 패턴</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {s.newPatterns.length === 0 ? (
              <span className="text-[14px] text-ink-dim/70">이번 판에는 없어요</span>
            ) : (
              s.newPatterns.map((k) => {
                const p = patternFromKey(k);
                return (
                  <span key={k} className="flex items-center gap-1 rounded-full bg-mint/20 py-0.5 pl-0.5 pr-2.5 text-[14px] text-mint">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset(R('badges/badge-pattern.svg'))} alt="" className="h-6 w-6" />
                    {p ? `${p.def.name} (${p.meterId})` : k}
                  </span>
                );
              })
            )}
          </div>

          <div className="mt-3 text-[14px] text-ink-dim">이번 판 최고의 마디</div>
          <div className="mt-1">
            {s.bestMeasure ? (
              <BestMeasure m={s.bestMeasure} rules={data.rules} strict={strict} />
            ) : (
              <span className="text-[14px] text-ink-dim/70">완성한 마디가 없어요. 한 줄을 빈칸 없이 채워 봐요!</span>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {clear && data.hasNext && (
              <Button size="lg" onClick={onNext} autoFocus>
                다음 스테이지
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant={clear ? 'secondary' : 'default'} size={clear ? 'default' : 'lg'} className="flex-1" onClick={onRetry} autoFocus={!clear}>
                다시 하기
              </Button>
              <Button variant="secondary" size={clear ? 'default' : 'lg'} className="flex-1" onClick={onMenu}>
                메뉴
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-50 h-48 overflow-hidden">
      {pieces.map((i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={asset(R('fx/fx-confetti.svg'))}
          alt=""
          className="rh-confetti absolute"
          style={{ left: `${(i * 17 + 3) % 90}%`, top: 0, width: 130, animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}

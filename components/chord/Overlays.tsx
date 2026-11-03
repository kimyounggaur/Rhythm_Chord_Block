'use client';
// 게임 위에 뜨는 창 — 스테이지 시작 카드(§14-7), 일시정지, 스테이지 클리어·게임 오버 요약(§14-8), 퍼즐 결과
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { chordOf, goalsOf, type PuzzleDef } from '@/lib/chord/defs';
import { collectionDef } from '@/lib/chord/collection';
import { goalText, romanSeq } from '@/lib/chord/goals';
import type { ChordId, RunStats, StageConfig } from '@/lib/chord/types';
import { formatScore, cn } from '@/lib/utils';
import { stageArt } from './art';
import { ChordBadge, ChordChip, Img, Panel } from './bits';
import { Mascot } from './GameParts';
import { RText } from './Roman';

export function Overlay({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('absolute inset-0 z-50 flex items-center justify-center bg-[#0b0b24]/75 p-3 backdrop-blur-[2px]', className)}>
      {children}
    </div>
  );
}

// ───────────────────────── 시작 카드

export function IntroCard({
  mode,
  stage,
  puzzle,
  onStart,
  onBack,
}: {
  mode: 'campaign' | 'endless' | 'puzzle';
  stage: StageConfig;
  puzzle: PuzzleDef | null;
  onStart: () => void;
  onBack: () => void;
}) {
  const goals = goalsOf(stage);
  const active = puzzle ? puzzle.activeChords : stage.rules.activeChords;
  return (
    <Overlay>
      <Panel className="pop-in flex max-h-full w-full max-w-[380px] flex-col p-4">
        <div className="cm-scroll -mx-1 min-h-0 flex-1 px-1">
          <div className="text-[15px] leading-none text-ink-dim">
            {mode === 'puzzle' ? '연쇄 퍼즐' : mode === 'endless' ? `무한 모드 · 스테이지 ${stage.id}` : `스테이지 ${stage.id}`}
          </div>
          <h2 className="mt-1 text-[28px] leading-tight text-gold">
            <RText text={puzzle ? puzzle.title : stage.name} />
          </h2>
          {!puzzle && <Img path={stageArt(stage.id)} className="mt-2 w-full rounded-2xl" style={{ aspectRatio: '320 / 200', height: 'auto' }} />}
          <p className="mt-3 text-[18px] leading-snug text-ink">
            {puzzle
              ? '정해진 조각으로 연쇄를 만들어요. 조각은 저절로 내려오지 않아요. 천천히·한 번에 내리기 버튼으로 놓아요.'
              : mode === 'endless'
                ? '목표 없이 끝까지! 최고 점수에 도전해요.'
                : <RText text={stage.card.text} />}
          </p>
          <div className="mt-3 rounded-2xl bg-bg2/80 px-3 py-2">
            <div className="text-[13px] text-ink-dim">목표</div>
            {puzzle ? (
              <div className="text-[17px] text-ink">
                <RText text={`${puzzle.goal.chain}연쇄${puzzle.goal.progression ? ` · ${romanSeq(puzzle.goal.progression)}` : ''} (조각 ${puzzle.pairs.length}개)`} />
              </div>
            ) : mode === 'endless' ? (
              <div className="text-[17px] text-ink">게임 오버까지 점수 모으기</div>
            ) : (
              goals.map((g, i) => (
                <div key={i} className="text-[17px] leading-snug text-ink">
                  <RText text={goalText(g)} />
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {active.map((c) => (
              <ChordChip key={c} chord={c} height={34} />
            ))}
          </div>
        </div>
        <div className="mt-4 flex shrink-0 gap-2">
          <Button variant="secondary" className="flex-1" onClick={onBack}>
            뒤로
          </Button>
          <Button size="lg" className="flex-[2]" onClick={onStart} autoFocus>
            시작!
          </Button>
        </div>
      </Panel>
    </Overlay>
  );
}

// ───────────────────────── 일시정지

export function PauseCard({
  onResume,
  onRestart,
  onQuit,
  toggles,
  puzzleHint,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  toggles: { label: string; icon: string; on: boolean; set: (v: boolean) => void }[];
  puzzleHint: string | null;
}) {
  return (
    <Overlay>
      <Panel className="pop-in w-full max-w-[340px] p-4">
        <div className="flex items-center gap-3">
          <Mascot mood="normal" size={54} />
          <h2 className="text-[28px] text-gold">잠깐 쉬어요</h2>
        </div>
        {puzzleHint && (
          <p className="mt-2 flex items-start gap-1.5 rounded-2xl bg-bg2/80 px-3 py-2 text-[15px] leading-snug text-ink">
            <Img path="chord/icons/icon-hint.svg" className="shrink-0" style={{ width: 22, height: 22 }} />
            <RText text={puzzleHint} />
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {toggles.map((t) => (
            <label key={t.label} className="flex items-center justify-between gap-1 rounded-2xl bg-bg2/80 px-2.5 py-2 text-[15px] text-ink">
              <span className="flex items-center gap-1.5">
                <Img path={`chord/icons/${t.icon}.svg`} style={{ width: 24, height: 24 }} />
                {t.label}
              </span>
              <Switch checked={t.on} onCheckedChange={t.set} aria-label={t.label} />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Button size="lg" onClick={onResume} autoFocus>
            계속하기
          </Button>
          <div className="flex gap-2">
            <Button variant="sky" className="flex-1" onClick={onRestart}>
              다시 하기
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onQuit}>
              그만하기
            </Button>
          </div>
        </div>
      </Panel>
    </Overlay>
  );
}

// ───────────────────────── 결과·요약(§14-8)

const CADENCE_ORDER = ['정격마침', '정격마침(7)', '변격마침', '반마침', '마침 진행', '기본 진행'];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-line/40 py-1.5 last:border-b-0">
      <span className="shrink-0 text-[14px] leading-6 text-ink-dim">{label}</span>
      <span className="min-w-0 text-right text-[16px] leading-6 text-ink">{children}</span>
    </div>
  );
}

export function Summary({ stats, active }: { stats: RunStats; active: ChordId[] }) {
  const chordIds = Array.from(new Set<ChordId>([...active, ...(Object.keys(stats.popsByChord) as ChordId[])]));
  const cadences = CADENCE_ORDER.filter((n) => stats.cadences[n]);
  return (
    <div className="rounded-2xl bg-bg2/80 px-3 py-1">
      <Row label="터뜨린 화음">
        <span className="flex flex-wrap justify-end gap-x-2">
          {chordIds.map((c) => (
            <span key={c} className="inline-flex items-center gap-0.5">
              <ChordBadge chord={c} size={20} />
              {stats.popsByChord[c] ?? 0}
            </span>
          ))}
        </span>
      </Row>
      <Row label="최대 연쇄">{stats.maxChain}</Row>
      <Row label="마침꼴">{cadences.length ? cadences.map((n) => `${n} ${stats.cadences[n]}`).join(' · ') : '아직 없어요'}</Row>
      <Row label="공통음 동시">{stats.sharedPops}번</Row>
      <Row label="최대 성부">{stats.maxGroup ? `${stats.maxGroup}성부` : '–'}</Row>
      <Row label="새로 등록한 진행">{stats.newCollections.length ? stats.newCollections.map((id) => collectionDef(id)?.name ?? id).join(' · ') : '없음'}</Row>
      <Row label="최고의 연쇄">
        {stats.bestChain ? (
          <span className="inline-flex flex-wrap items-center justify-end gap-0.5">
            {stats.bestChain.progression.map((c, i) => (
              <span key={i} className="inline-flex items-center">
                {i > 0 && <span className="mx-0.5 text-ink-dim">→</span>}
                <ChordBadge chord={c} size={22} />
              </span>
            ))}
            <span className="ml-1 text-[13px] text-ink-dim">{formatScore(stats.bestChain.totalScore)}점</span>
          </span>
        ) : (
          '–'
        )}
      </Row>
    </div>
  );
}

export function ResultCard({
  kind,
  score,
  best,
  stats,
  active,
  title,
  note,
  onRetry,
  onNext,
  nextLabel = '다음 스테이지',
  onMenu,
}: {
  kind: 'clear' | 'over' | 'puzzleSolved' | 'puzzleFail';
  score: number;
  best: number | null;
  stats: RunStats;
  active: ChordId[];
  title: string;
  note?: string | null;
  onRetry: () => void;
  onNext?: () => void;
  nextLabel?: string;
  onMenu: () => void;
}) {
  const happy = kind === 'clear' || kind === 'puzzleSolved';
  const ribbon = kind === 'clear' ? 'chord/ui/ribbon-clear.svg' : kind === 'over' ? 'chord/ui/ribbon-gameover.svg' : null;
  return (
    <Overlay>
      {happy && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Img key={i} path="chord/fx/fx-confetti.svg" className="cm-confetti absolute" style={{ left: `${i * 33 - 6}%`, top: 0, width: '45%', animationDelay: `${i * 0.5}s` }} />
          ))}
        </div>
      )}
      <div className="relative mx-auto flex max-h-full w-full max-w-[400px] flex-col">
        <div className="flex shrink-0 flex-col items-center">
          {ribbon ? (
            <Img path={ribbon} className="cm-ribbon w-[86%]" style={{ height: 'auto' }} />
          ) : (
            <div className="cm-ribbon rounded-3xl border-[3px] border-white/80 bg-gradient-to-b from-[#ffe27a] to-[#f5a524] px-6 py-2 text-[30px] text-[#6b3500] shadow-[0_5px_0_rgba(0,0,0,.35)]">
              {kind === 'puzzleSolved' ? '퍼즐 성공!' : '아깝다!'}
            </div>
          )}
        </div>
        <Panel className="pop-in mt-2 flex min-h-0 flex-col p-3">
          <div className="flex items-center gap-3">
            <Mascot mood={happy ? 'happy' : 'oops'} size={60} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] text-ink-dim">
                <RText text={title} />
              </div>
              {kind === 'puzzleFail' || kind === 'puzzleSolved' ? (
                <div className="text-[22px] leading-tight text-ink">
                  <RText text={note ?? ''} />
                </div>
              ) : (
                <>
                  <div className="text-[34px] leading-none text-gold">{formatScore(score)}</div>
                  {best !== null && <div className="mt-1 text-[14px] text-ink-dim">{score >= best && score > 0 ? '🎉 최고 기록!' : `최고 ${formatScore(best)}`}</div>}
                </>
              )}
            </div>
          </div>
          {kind !== 'puzzleFail' && kind !== 'puzzleSolved' && note && (
            <p className="mt-2 text-[15px] leading-snug text-mint">
              <RText text={note} />
            </p>
          )}
          <div className="cm-scroll mt-2 min-h-0 shrink">
            <Summary stats={stats} active={active} />
          </div>
          <div className="mt-3 flex shrink-0 gap-2">
            <Button variant="secondary" className="flex-1" onClick={onMenu}>
              메뉴
            </Button>
            <Button variant={onNext ? 'sky' : 'default'} className="flex-1" onClick={onRetry} autoFocus={!onNext}>
              다시 하기
            </Button>
            {onNext && (
              <Button className="flex-1" onClick={onNext} autoFocus>
                {nextLabel}
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </Overlay>
  );
}

export function chordLine(id: ChordId): string {
  const c = chordOf(id);
  return `${c.roman} ${c.name} (${c.tones.join('·')})`;
}

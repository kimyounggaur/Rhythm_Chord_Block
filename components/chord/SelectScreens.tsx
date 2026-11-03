'use client';
// 스테이지 고르기(캠페인·무한, §12) · 연쇄 퍼즐 고르기(부록 C) · 진행 도감(§11)
import { COLLECTION, PUZZLES, STAGES, chordOf, goalsOf, type PuzzleDef } from '@/lib/chord/defs';
import { goalText, romanSeq } from '@/lib/chord/goals';
import { parseGrid } from '@/lib/chord/grid';
import { activeTones } from '@/lib/chord/defs';
import { highScoreKey, isEndlessUnlocked, isPuzzleUnlocked, isStageUnlocked } from '@/lib/chord/save';
import { useChordStore } from '@/store/chord';
import { cn, formatScore } from '@/lib/utils';
import { collectionArt, stageArt, tileArt } from './art';
import { ChordBadge, Img, ScreenHeader } from './bits';
import { RText } from './Roman';

function Tabs({ tab, set }: { tab: 'campaign' | 'endless'; set: (t: 'campaign' | 'endless') => void }) {
  return (
    <div className="mx-4 mb-2 flex shrink-0 rounded-full border-2 border-line bg-bg2/90 p-1">
      {(['campaign', 'endless'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => set(t)}
          className={cn('h-10 flex-1 rounded-full text-[18px] transition-colors', tab === t ? 'bg-gold text-ink-dark shadow-[0_3px_0_#c98710]' : 'text-ink-dim')}
        >
          {t === 'campaign' ? '스테이지' : '무한 모드'}
        </button>
      ))}
    </div>
  );
}

export function StageSelect() {
  const save = useChordStore((s) => s.save);
  const tab = useChordStore((s) => s.stageTab);
  const go = useChordStore((s) => s.go);
  const openStages = useChordStore((s) => s.openStages);
  const startGame = useChordStore((s) => s.startGame);
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={tab === 'campaign' ? '스테이지' : '무한 모드'} onBack={() => go('menu')} />
      <Tabs tab={tab} set={(t) => openStages(t)} />
      {tab === 'endless' && <p className="mx-5 mb-2 text-[14px] leading-snug text-ink-dim cm-text-shadow">깬 스테이지의 화음·속도 그대로, 목표 없이 끝까지 해요.</p>}
      <div className="cm-scroll min-h-0 flex-1 px-3 pb-4">
        <div className="mx-auto flex max-w-[420px] flex-col gap-2.5">
          {STAGES.map((s, i) => {
            const open = tab === 'campaign' ? isStageUnlocked(save, s.id) : isEndlessUnlocked(save, s.id);
            const cleared = save.clearedStages.includes(s.id);
            const best = save.highScores[highScoreKey(tab, s.id)];
            return (
              <button
                key={s.id}
                type="button"
                disabled={!open}
                onClick={() => startGame(tab, s.id)}
                className="pop-in flex w-full items-stretch gap-3 rounded-3xl border-2 border-line bg-panel/92 p-2 text-left shadow-[0_4px_0_rgba(0,0,0,.35)] transition-transform active:translate-y-[3px] disabled:opacity-75"
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <div className="relative shrink-0 overflow-hidden rounded-2xl" style={{ width: 104, height: 65 }}>
                  <Img path={stageArt(s.id)} style={{ width: 104, height: 65 }} className={cn(!open && 'opacity-35 grayscale')} />
                  {!open && <Img path="chord/icons/icon-lock.svg" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 38, height: 38 }} />}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[19px] leading-tight text-ink">
                      <RText text={`${s.id}. ${s.name}`} />
                    </span>
                    {cleared && <Img path="chord/icons/icon-check.svg" style={{ width: 22, height: 22 }} className="shrink-0" />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-0.5">
                    {s.rules.activeChords.map((c) => (
                      <ChordBadge key={c} chord={c} size={20} />
                    ))}
                    <span className="ml-1 truncate text-[12px] text-ink-dim">{s.rules.garbage.enabled ? '방해 타일 · ' : ''}레벨 {s.startLevel}부터</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] leading-snug text-ink-dim">
                    {!open
                      ? tab === 'campaign'
                        ? '앞 스테이지를 깨면 열려요'
                        : '이 스테이지를 깨면 열려요'
                      : tab === 'campaign'
                        ? <RText text={goalsOf(s).map(goalText).join(' · ')} />
                        : '목표 없이 끝까지'}
                    {open && best ? <span className="text-gold"> · 최고 {formatScore(best)}</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniBoard({ p }: { p: PuzzleDef }) {
  const { board } = parseGrid(p.board);
  const first = board.findIndex((row, y) => y > 0 && row.some(Boolean));
  const from = Math.max(1, Math.min(first < 0 ? 14 : first, 9));
  const c = 11;
  const on = activeTones(p.activeChords);
  return (
    <div className="relative shrink-0 rounded-lg border border-line/70 bg-[#151540]" style={{ width: 7 * c + 4, height: (15 - from) * c + 4 }}>
      {board.slice(from).map((row, i) =>
        row.map((t, x) =>
          t ? (
            <Img
              key={`${x}-${i}`}
              path={tileArt(t.pitch, t.pitch !== null && !on.has(t.pitch))}
              className="absolute"
              style={{ left: 2 + x * c, top: 2 + i * c, width: c, height: c }}
            />
          ) : null,
        ),
      )}
    </div>
  );
}

export function PuzzleSelect() {
  const save = useChordStore((s) => s.save);
  const go = useChordStore((s) => s.go);
  const startGame = useChordStore((s) => s.startGame);
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title="연쇄 퍼즐" onBack={() => go('menu')} />
      <p className="mx-5 mb-2 text-[14px] leading-snug text-ink-dim cm-text-shadow">정해진 보드에 정해진 조각을 놓아 지정한 연쇄를 만들어요. 조각은 저절로 내려오지 않아요.</p>
      <div className="cm-scroll min-h-0 flex-1 px-3 pb-4">
        <div className="mx-auto flex max-w-[420px] flex-col gap-2.5">
          {PUZZLES.map((p, i) => {
            const open = isPuzzleUnlocked(save, p);
            const solved = save.puzzlesSolved.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={!open}
                onClick={() => startGame('puzzle', 3, p.id)}
                className="pop-in flex w-full items-center gap-3 rounded-3xl border-2 border-line bg-panel/92 p-2.5 text-left shadow-[0_4px_0_rgba(0,0,0,.35)] transition-transform active:translate-y-[3px] disabled:opacity-70"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className={cn('relative', !open && 'opacity-40 grayscale')}>
                  <MiniBoard p={p} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[20px] leading-tight text-ink">
                      {i + 1}. {p.title}
                    </span>
                    {solved && <Img path="chord/icons/icon-star-on.svg" style={{ width: 24, height: 24 }} />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {p.goal.progression?.map((c, k) => (
                      <span key={k} className="inline-flex items-center">
                        {k > 0 && <span className="mx-0.5 text-ink-dim">→</span>}
                        <ChordBadge chord={c} size={24} />
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-[13px] text-ink-dim">{open ? `${p.goal.chain}연쇄 · 조각 ${p.pairs.length}개` : `스테이지 ${p.stageMin}이 열리면 풀 수 있어요`}</div>
                </div>
                {!open && <Img path="chord/icons/icon-lock.svg" style={{ width: 34, height: 34 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CollectionScreen() {
  const save = useChordStore((s) => s.save);
  const go = useChordStore((s) => s.go);
  const got = COLLECTION.filter((c) => (save.collections[c.id] ?? 0) > 0).length;
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={`진행 도감 ${got}/${COLLECTION.length}`} onBack={() => go('menu')} />
      <p className="mx-5 mb-2 text-[14px] leading-snug text-ink-dim cm-text-shadow">연쇄의 대표 화음 순서가 진행과 같으면 등록! 처음 +500점, 다시 하면 +100점.</p>
      <div className="cm-scroll min-h-0 flex-1 px-3 pb-4">
        <div className="mx-auto flex max-w-[420px] flex-col gap-2.5">
          {COLLECTION.map((c, i) => {
            const n = save.collections[c.id] ?? 0;
            const chords = c.progression ?? c.shared?.chords ?? [];
            const tones = chords.map((id) => chordOf(id).tones.join('')).join(c.shared ? ' + ' : ' → ');
            return (
              <div
                key={c.id}
                className={cn('pop-in flex items-center gap-3 rounded-3xl border-2 bg-panel/92 p-2 shadow-[0_4px_0_rgba(0,0,0,.35)]', n ? 'border-gold/70' : 'border-line')}
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <Img path={collectionArt(c.id, n > 0)} style={{ width: 140, height: 56 }} className="shrink-0" />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={cn('truncate text-[18px]', n ? 'text-gold' : 'text-ink')}>{c.name}</span>
                    <span className="shrink-0 text-[13px] text-ink-dim">{n ? `${n}번` : '아직'}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[14px] text-ink">
                    <RText text={c.progression ? romanSeq(c.progression) : c.shared ? `${chords.map((id) => chordOf(id).roman).join(' + ')} 동시` : '크기 6 이상 한 번에'} />
                    {c.extension ? <span className="text-ink-dim"> · 확장</span> : null}
                  </div>
                  {tones && <div className="truncate text-[12px] text-ink-dim">{tones}</div>}
                  <div className="truncate text-[13px] text-mint">{c.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

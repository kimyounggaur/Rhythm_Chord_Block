// 점수 — 설계서 §10
//   한 단계 점수 = 10 × 터진 계이름 타일 수 × max(1, 연쇄 + 성부 + 동시 + 진행)
//   연쇄(chainPower) 0·6·14·28·50·80·110·140·170·200, 이후 +30
//   성부(덩어리 크기, 이벤트마다 합산) 4→0, 5→2, 6→3, 7→4, 8→5, 9→6, 10→7, 11+→10
//   동시 화음: 2개 +3, 공통음 공유 +6, 3개 +8 / 진행: §8 표 + 완성 보너스
import { SCORE_TABLE, chordOf } from './defs';
import { mainChordOf, progressionBonus, sequenceBonus } from './progression';
import type { ChainStep, ChordId, PopEvent, PopResult, ScoreItem } from './types';

export function chainPowerOf(chain: number): number {
  const t = SCORE_TABLE.chainPower;
  if (chain <= 0) return 0;
  if (chain <= t.length) return t[chain - 1];
  return t[t.length - 1] + SCORE_TABLE.chainPowerStep * (chain - t.length);
}

export function groupBonusOf(size: number): number {
  const g = SCORE_TABLE.groupBonus;
  if (size >= 11) return g['11+'];
  return g[String(size)] ?? 0;
}

/** 서로 다른 화음 수로 센다. 같은 화음 덩어리 둘은 '동시 화음'이 아니다(성부 보너스만 따로 받는다) */
export function simulBonusOf(events: PopEvent[]): { bonus: number; label: string | null; shared: boolean } {
  const distinct = new Set(events.map((e) => e.chord));
  if (distinct.size >= 3) return { bonus: SCORE_TABLE.simul.three, label: '세 화음 동시!', shared: sharedBetweenChords(events) };
  if (distinct.size === 2) {
    const shared = sharedBetweenChords(events);
    return shared
      ? { bonus: SCORE_TABLE.simul.twoShared, label: '공통음!', shared: true }
      : { bonus: SCORE_TABLE.simul.two, label: '동시 화음', shared: false };
  }
  return { bonus: 0, label: null, shared: false };
}

/** 서로 다른 화음의 두 이벤트가 같은 칸(공통음 타일)을 가졌는가 */
export function sharedBetweenChords(events: PopEvent[]): boolean {
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (events[i].chord === events[j].chord) continue;
      const a = new Set(events[i].cells.map(([x, y]) => `${x},${y}`));
      if (events[j].cells.some(([x, y]) => a.has(`${x},${y}`))) return true;
    }
  }
  return false;
}

export function eventLabel(e: PopEvent): string {
  const c = chordOf(e.chord);
  return `${c.roman} ${c.name} ${e.size}성부`;
}

/** 한 단계 점수(§10). prevSteps = 이 연쇄의 앞 단계들 */
export function scoreStep(pops: PopResult, chain: number, prevSteps: ChainStep[], removedCount = pops.removedCells.length): ChainStep {
  const events = pops.events;
  const chainPower = chainPowerOf(chain);
  const groupBonus = events.reduce((a, e) => a + groupBonusOf(e.size), 0);
  const simul = simulBonusOf(events);
  const mainChord = mainChordOf(events);
  const curChords = Array.from(new Set(events.map((e) => e.chord)));

  const prev = prevSteps[prevSteps.length - 1];
  const pair = prev
    ? progressionBonus(Array.from(new Set(prev.events.map((e) => e.chord))), curChords)
    : { bonus: 0, name: null, from: null, to: null, text: null, hint: null };
  const mains: ChordId[] = [...prevSteps.map((s) => s.mainChord), mainChord];
  const seq = prev ? sequenceBonus(mains) : { total: 0, items: [] };
  const progression = pair.bonus + seq.total;

  const mult = Math.max(1, chainPower + groupBonus + simul.bonus + progression);
  const score = 10 * pops.poppedCount * mult;

  const breakdown: ScoreItem[] = [];
  for (const e of events) breakdown.push({ label: eventLabel(e), points: groupBonusOf(e.size) });
  if (chain >= 2) breakdown.push({ label: `${chain}연쇄`, points: chainPower });
  if (simul.label) breakdown.push({ label: simul.label, points: simul.bonus });
  if (pair.name) breakdown.push({ label: pair.name, points: pair.bonus });
  for (const s of seq.items) breakdown.push({ label: s.name, points: s.bonus });

  // §8 표의 이름(정격마침 등). 완성 보너스 이름(마침 진행 등)은 sequences 에 따로 있다
  const progressionName = pair.name;

  return {
    index: chain,
    events,
    mainChord,
    poppedCount: pops.poppedCount,
    chainPower,
    groupBonus,
    simulBonus: simul.bonus,
    progressionBonus: progression,
    progressionName,
    score,
    breakdown,
    pairBonus: pair.bonus,
    pairFrom: pair.from,
    pairTo: pair.to,
    pairText: pair.text,
    reverseHint: pair.hint,
    sequences: seq.items,
    sharedCount: pops.sharedCount,
    simulLabel: simul.label,
    removedCount,
  };
}

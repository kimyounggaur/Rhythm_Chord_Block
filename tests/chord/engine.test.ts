// 엔진 흐름: 점수 합계 = 내역 합(§17 M4), 도감 첫 달성 +500 / 재달성 +100(§11), 전체 지우기 +2000(§10),
// 스테이지 목표·클리어(§12), 대전 준비 BattleAdapter(§17 M10), 요약 숫자(§14-8)
import { describe, expect, it } from 'vitest';
import { ChordBattleAdapter } from '@/lib/chord/battle';
import { resolve } from '@/lib/chord/chain';
import { stageById } from '@/lib/chord/defs';
import { ChordEngine, type EngineEvent } from '@/lib/chord/engine';
import { goalText, updateGoals, initGoals } from '@/lib/chord/goals';
import { addChain, emptyStats } from '@/lib/chord/stats';
import { grid, RULES } from './helpers';

const T7 = ['G . . . . . .', 'E . . . . . .', 'C . . . . . .', 'D . . . . . .', 'B . . . . . .', 'G C . . . . .', 'C X . . . . .', 'A D . . . . .', 'F A . . . . .'];

function runUntil(e: ChordEngine, pred: () => boolean, ms = 20000) {
  const ev: EngineEvent[] = [];
  for (let t = 0; t < ms && !pred(); t += 16) {
    e.update(16);
    ev.push(...e.drainEvents());
  }
  return ev;
}

describe('엔진: T7 보드를 해결 루프로 재생', () => {
  it('3단계를 순서대로 터뜨리고, 점수 = 1800 + 전체 지우기 2000 + 도감(cad3 첫 달성) 500', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(3), seed: 1 });
    e.start();
    e.debugLoadGrid(T7);
    e.debugResolveNow();
    expect(e.phase).toBe('resolving');
    const ev = runUntil(e, () => e.phase === 'falling');
    const steps = ev.filter((x) => x.type === 'step');
    expect(steps).toHaveLength(3);
    const end = ev.find((x) => x.type === 'chainEnd') as Extract<EngineEvent, { type: 'chainEnd' }>;
    expect(end.result.totalScore).toBe(1800);
    expect(end.bonuses.map((b) => b.points)).toEqual([2000, 500]);
    expect(e.score).toBe(1800 + 2000 + 500);
    expect(e.score).toBe(e.ledger.drops + e.ledger.steps + e.ledger.allClear + e.ledger.collection);
    expect(e.collections.cad3).toBe(1);
    // 같은 진행을 또 하면 +100
    e.debugLoadGrid(T7);
    e.debugResolveNow();
    const ev2 = runUntil(e, () => e.phase === 'falling');
    const end2 = ev2.find((x) => x.type === 'chainEnd') as Extract<EngineEvent, { type: 'chainEnd' }>;
    expect(end2.collections).toEqual([{ id: 'cad3', first: false, points: 100 }]);
    expect(e.stats.maxChain).toBe(3);
    expect(e.stats.cadences['마침 진행']).toBe(2);
    expect(e.stats.newCollections).toEqual(['cad3']);
    expect(e.stats.bestChain?.progression).toEqual(['IV', 'V', 'I']);
  });

  it('연쇄 중에는 조작이 안 되고(일시정지만), 일시정지 동안 시간이 흐르지 않는다', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(3), seed: 1 });
    e.start();
    e.debugLoadGrid(T7);
    e.debugResolveNow();
    expect(e.move(1)).toBe(false);
    expect(e.rotate(true)).toBe(false);
    expect(e.hardDrop()).toBe(false);
    e.pause();
    e.update(10000);
    expect(e.phase).toBe('resolving');
    e.resume();
    runUntil(e, () => e.phase === 'falling');
    expect(e.phase).toBe('falling');
  });
});

describe('스테이지 목표', () => {
  it('목표 글', () => {
    expect(goalText({ type: 'chordPops', chord: 'I', count: 10 })).toBe('Ⅰ 10번 터뜨리기');
    expect(goalText({ type: 'cadence', progression: ['V', 'I'], count: 5 })).toBe('Ⅴ→Ⅰ 정격마침 5번');
    expect(goalText({ type: 'progression', progression: ['IV', 'V', 'I'], count: 3 })).toBe('Ⅳ→Ⅴ→Ⅰ 3연쇄 3번');
    expect(goalText({ type: 'survive', count: 60 })).toBe('조각 60개 버티기');
  });
  it('스테이지 7 목표(Ⅳ→Ⅴ→Ⅰ 3번)는 T7 같은 연쇄 3번으로 채워진다', () => {
    let g = initGoals([{ type: 'progression', progression: ['IV', 'V', 'I'], count: 3 }]);
    const r = resolve(grid(...T7), RULES);
    for (let i = 0; i < 3; i++) g = updateGoals(g, r, { pieces: 0, score: 0 });
    expect(g[0].done).toBe(true);
  });
  it('엔진: 목표를 채우면 stageClear (스테이지 4 — 정격마침 5번)', () => {
    const T6fixed = ['C . . . . . .', 'C D . . . . .', 'B D . . . . .', 'G E G . . . .'];
    const e = new ChordEngine({ mode: 'campaign', stage: stageById(4), seed: 4 });
    e.start();
    for (let i = 0; i < 5; i++) {
      expect(e.phase).toBe('falling');
      e.debugLoadGrid(T6fixed);
      e.debugResolveNow();
      runUntil(e, () => e.phase !== 'resolving');
    }
    expect(e.goals[0].value).toBe(5);
    expect(e.phase).toBe('stageClear');
  });
  it('스테이지 1 목표는 Ⅰ 터뜨린 횟수', () => {
    const e = new ChordEngine({ mode: 'campaign', stage: stageById(1), seed: 4 });
    e.start();
    e.debugLoadGrid(['C E . . . . .', 'C G . . . . .']);
    e.debugResolveNow();
    runUntil(e, () => e.phase === 'falling');
    expect(e.goals[0].value).toBe(1);
    expect(e.stats.popsByChord.I).toBe(1);
  });
});

describe('요약 숫자(§14-8)가 실제 연쇄와 맞다', () => {
  it('addChain 은 화음별 횟수·최대 연쇄·마침꼴·공통음·최대 성부를 센다', () => {
    let s = emptyStats();
    s = addChain(s, resolve(grid(...T7), RULES), ['cad3']);
    s = addChain(s, resolve(grid('. . C . . . .', 'F A C E G . .'), RULES), ['shared-c']);
    s = addChain(s, resolve(grid('C E G . . . .', 'C E G . . . .'), RULES));
    expect(s.popsByChord).toEqual({ IV: 2, V: 1, I: 3 });
    expect(s.maxChain).toBe(3);
    expect(s.cadences).toEqual({ '딸림 준비': 1, 정격마침: 1, '마침 진행': 1 });
    expect(s.sharedPops).toBe(1);
    expect(s.maxGroup).toBe(6);
    expect(s.newCollections).toEqual(['cad3', 'shared-c']);
    expect(s.chains).toBe(3);
  });
});

describe('BattleAdapter (대전 준비)', () => {
  it('공격량 = 단계 점수 ÷ 60, 나머지는 다음 단계로 이월', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(3), seed: 1 });
    const a = new ChordBattleAdapter(e);
    expect(a.attackFrom(resolve(grid(...T7), RULES))).toBe(30); // 40/60 → 0 (40 남음), 440/60 → 7 (20), 1380/60 → 23 (0)
    expect(a.carry).toBe(0);
    const t1 = resolve(grid('C E . . . . .', 'C G . . . . .'), RULES); // 40
    expect(a.attackFrom(t1)).toBe(0);
    expect(a.carry).toBe(40);
    expect(a.attackFrom(t1)).toBe(1); // 80 → 1, 20 남음
    expect(a.carry).toBe(20);
  });
  it('receive(n) 은 방해 타일로 받고, isDead 는 게임 오버', () => {
    const e = new ChordEngine({ mode: 'endless', stage: stageById(3), seed: 1 });
    const a = new ChordBattleAdapter(e);
    e.start();
    a.receive(4);
    expect(e.pendingGarbage).toBe(4);
    e.hardDrop();
    runUntil(e, () => e.pendingGarbage === 0 && e.phase === 'falling', 3000);
    expect(e.board.flat().filter((t) => t?.kind === 'garbage')).toHaveLength(4);
    expect(a.isDead()).toBe(false);
    e.debugGameOver();
    expect(a.isDead()).toBe(true);
  });
});

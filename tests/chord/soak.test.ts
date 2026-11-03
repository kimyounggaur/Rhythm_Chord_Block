// 오래 돌리기(§17 M1 완료 기준 "10분 플레이에 오류 없음") — 화면 없이 엔진만, 아무렇게나 누르며 스테이지마다 10분 이상.
// 매 순간 보드 불변식을 검사한다: 크기 15×7, 타일 id 중복 없음, 조작 중에는 공중에 뜬 타일 없음·조각이 다른 타일과 겹치지 않음,
// 점수 = 내역 합, 요약 숫자 = 연쇄 결과를 다시 센 값.
import { describe, expect, it } from 'vitest';
import { COLS, ROWS, isSettled } from '@/lib/chord/board';
import { STAGES, PUZZLES, stageById } from '@/lib/chord/defs';
import { ChordEngine, type EngineEvent } from '@/lib/chord/engine';
import { pairTiles } from '@/lib/chord/pair';
import { Rng } from '@/lib/chord/spawn';
import { addChain, emptyStats } from '@/lib/chord/stats';
import type { GameMode, StageConfig } from '@/lib/chord/types';

const TEN_MINUTES = 10 * 60 * 1000;

/** 매 프레임 부르므로 expect 대신 가벼운 검사(어기면 바로 던진다) */
function checkInvariants(e: ChordEngine) {
  const fail = (msg: string) => {
    throw new Error(`불변식 위반: ${msg} (phase=${e.phase})`);
  };
  if (e.board.length !== ROWS) fail('줄 수');
  const ids = new Set<number>();
  for (const row of e.board) {
    if (row.length !== COLS) fail('칸 수');
    for (const t of row) {
      if (!t) continue;
      if (ids.has(t.id)) fail(`타일 id 중복 ${t.id}`);
      ids.add(t.id);
      if ((t.kind === 'garbage') !== (t.pitch === null)) fail('타일 종류와 음이 맞지 않음');
    }
  }
  if (e.phase === 'falling') {
    if (!isSettled(e.board)) fail('조작 중인데 공중에 뜬 타일');
    if (!e.pair) fail('조작 중인데 조각 없음');
    for (const t of pairTiles(e.pair!)) {
      if (t.x < 0 || t.x >= COLS || t.y < 0 || t.y >= ROWS) fail('조각이 보드 밖');
      if (e.board[t.y][t.x]) fail('조각이 타일과 겹침');
      if (ids.has(t.id)) fail('조각 id 가 보드 타일과 같음');
    }
  }
  if (!Number.isInteger(e.score) || e.score < 0) fail('점수');
  if (e.score !== e.ledger.drops + e.ledger.steps + e.ledger.allClear + e.ledger.collection) fail('점수 ≠ 내역 합');
  if (e.level < 1) fail('레벨');
}

function soak(stage: StageConfig, mode: GameMode, seed: number, simMs: number) {
  const rng = new Rng(seed);
  let simulated = 0;
  let games = 0;
  let chains = 0;
  let maxChain = 0;
  let garbage = 0;
  let collections: Record<string, number> = {};
  while (simulated < simMs) {
    const e = new ChordEngine({ mode, stage, seed: seed + games * 7919, collections });
    games++;
    e.start();
    let recount = emptyStats();
    let held = false;
    while (simulated < simMs && e.phase !== 'gameover' && e.phase !== 'stageClear') {
      // 아무렇게나 누르기(사람보다 훨씬 자주)
      const r = rng.next();
      if (r < 0.12) e.move(-1);
      else if (r < 0.24) e.move(1);
      else if (r < 0.32) e.rotate(true);
      else if (r < 0.38) e.rotate(false);
      else if (r < 0.41) {
        e.rotate(true);
        e.rotate(true); // 300ms 안 두 번(뒤집기 경로)
      } else if (r < 0.45) e.hardDrop();
      else if (r < 0.5) {
        held = !held;
        e.setSoftDrop(held);
      } else if (r < 0.505) {
        e.pause();
        e.update(500);
        e.resume();
      }
      const dt = 8 + rng.int(43);
      e.update(dt);
      simulated += dt;
      for (const ev of e.drainEvents() as EngineEvent[]) {
        if (ev.type === 'chainEnd') {
          chains++;
          maxChain = Math.max(maxChain, ev.result.chain);
          recount = addChain(recount, ev.result, ev.collections.filter((c) => c.first).map((c) => c.id));
          expect(ev.result.totalScore).toBe(ev.result.steps.reduce((a, s) => a + s.score, 0));
        }
        if (ev.type === 'garbage') garbage += ev.count;
      }
      checkInvariants(e);
    }
    // 요약 숫자 = 실제
    expect(e.stats.popsByChord).toEqual(recount.popsByChord);
    expect(e.stats.maxChain).toBe(recount.maxChain);
    expect(e.stats.cadences).toEqual(recount.cadences);
    expect(e.stats.sharedPops).toBe(recount.sharedPops);
    expect(e.stats.maxGroup).toBe(recount.maxGroup);
    expect(e.stats.newCollections).toEqual(recount.newCollections);
    collections = e.collections;
  }
  return { games, chains, maxChain, garbage };
}

describe('10분 이상 아무렇게나 해도 오류 없음(스테이지마다)', () => {
  it.each(STAGES.map((s) => [s.id, s] as const))('스테이지 %i', (_id, stage) => {
    const r = soak(stage, 'campaign', 1000 + stage.id, TEN_MINUTES);
    expect(r.games).toBeGreaterThan(0);
    expect(r.chains).toBeGreaterThan(0);
    if (stage.rules.garbage.enabled) expect(r.garbage).toBeGreaterThan(0);
  }, 120_000);

  it('무한 모드(스테이지 3 설정)', () => {
    const r = soak(stageById(3), 'endless', 77, TEN_MINUTES);
    expect(r.chains).toBeGreaterThan(10);
  }, 120_000);

  it('퍼즐 모드 5개', () => {
    for (const p of PUZZLES) {
      const rng = new Rng(5);
      for (let k = 0; k < 20; k++) {
        const e = new ChordEngine({ mode: 'puzzle', stage: stageById(3), puzzle: p, seed: k });
        e.start();
        for (let i = 0; i < 4000 && e.phase !== 'gameover' && e.phase !== 'stageClear'; i++) {
          const r = rng.next();
          if (r < 0.2) e.move(-1);
          else if (r < 0.4) e.move(1);
          else if (r < 0.5) e.rotate(true);
          else if (r < 0.55) e.hardDrop();
          e.update(16);
          checkInvariants(e);
        }
        expect(['gameover', 'stageClear']).toContain(e.phase);
      }
    }
  }, 60_000);
});

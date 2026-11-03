// 게임 진행(§6.1) — 잠금 대기, 보관, 게임 오버, 여러 줄 동시 완성, 콤보·퍼펙트·패턴 점수, 요약 통계(§14-6)
import { describe, expect, it } from 'vitest';
import { CLEAR_ANIM_MS, LOCK_DELAY_MS, LOCK_RESET_MAX, RhythmEngine, type ClearEvent, type EngineEvent } from '@/lib/rhythm/engine';
import { getStage } from '@/lib/rhythm/meters';
import { analyzeRow } from '@/lib/rhythm/measure';
import type { Cell, PieceType, StageConfig } from '@/lib/rhythm/types';
import { row, RULES_ALL } from './helpers';

function stage(over: Partial<StageConfig> = {}): StageConfig {
  return {
    id: 99,
    name: '테스트',
    meterId: '4/4',
    rules: RULES_ALL,
    targetMeasures: 0,
    startLevel: 1,
    card: { text: '', image: 'stage1.svg' },
    ...over,
  };
}

function engine(over: Partial<StageConfig> = {}, mode: 'campaign' | 'endless' = 'endless', seed = 3) {
  const e = new RhythmEngine({ mode, stage: stage(over), seed });
  e.start();
  return e;
}

function run(e: RhythmEngine, ms: number, step = 16) {
  for (let t = 0; t < ms; t += step) e.update(step);
}

function clears(events: EngineEvent[]): ClearEvent[] {
  return events.flatMap((ev) => (ev.type === 'clear' ? [ev.clear] : []));
}

/** 아래 4줄을 0열만 비워 채운다 → 세운 I 하나로 4줄 동시 완성 */
function fourLineSetup(e: RhythmEngine) {
  const rows: (Cell | null)[][] = [
    row('I9 I9 I9 I9 T9 T9 Z9 Z9'),
    row('O9 O9 O8 O8 O7 O7 O6 O6'),
    row('J9 S9 S9 Z8 Z8 T8 T8 L9'),
    row('L8 L8 L8 J8 T7 T7 T7 Z7'),
  ].map((r) => [null, ...r.slice(1)]);
  e.debugLoadRows(rows);
  e.debugSetActive('I', -2, 2, 1); // 세운 I: 상자 2열 → x=0
  e.drainEvents();
}

describe('잠금 대기 500ms, 재설정 최대 15회', () => {
  it('바닥에 닿으면 500ms 뒤 잠긴다', () => {
    const e = engine();
    e.debugSetActive('O', 3, 16);
    e.drainEvents();
    run(e, LOCK_DELAY_MS - 20);
    expect(e.s.active).not.toBeNull();
    expect(e.drainEvents().some((ev) => ev.type === 'lock')).toBe(false);
    run(e, 40);
    expect(e.drainEvents().some((ev) => ev.type === 'lock')).toBe(true);
  });

  it('이동하면 다시 세지만 15번까지만 — 그 뒤에는 500ms 안에 잠긴다', () => {
    const e = engine();
    e.debugSetActive('T', 3, 16);
    e.drainEvents();
    let moves = 0;
    let locked = false;
    for (let i = 0; i < 40 && !locked; i++) {
      run(e, 300); // 300ms 마다 한 번씩 좌우로
      if (e.drainEvents().some((ev) => ev.type === 'lock')) {
        locked = true;
        break;
      }
      e.move(i % 2 === 0 ? -1 : 1);
      moves++;
    }
    expect(locked).toBe(true);
    // 15번 재설정 뒤에는 타이머가 더는 0이 되지 않으므로, 300ms 간격이면 16·17번째 사이에 잠긴다
    expect(moves).toBeGreaterThanOrEqual(LOCK_RESET_MAX);
    expect(moves).toBeLessThanOrEqual(LOCK_RESET_MAX + 2);
  });

  it('공중에서의 이동은 재설정 횟수를 쓰지 않는다', () => {
    const e = engine();
    e.debugSetActive('T', 3, 4);
    for (let i = 0; i < 30; i++) e.move(i % 2 === 0 ? -1 : 1);
    expect(e.lockResetsUsed).toBe(0);
  });
});

describe('하드 드롭', () => {
  it('바닥까지 내리고 바로 잠근다, 칸당 +2', () => {
    const e = engine();
    e.debugSetActive('O', 3, 2);
    const before = e.s.score;
    expect(e.hardDrop()).toBe(true);
    expect(e.s.score - before).toBe(14 * 2);
    expect(e.s.board[17][4]?.type).toBe('O');
  });
  it('하드 드롭 뒤 300ms 동안 하드 드롭 입력 무시', () => {
    const e = engine();
    expect(e.hardDrop()).toBe(true);
    run(e, 100);
    expect(e.hardDrop()).toBe(false);
    run(e, 220);
    expect(e.hardDrop()).toBe(true);
  });
  it('소프트 드롭: 낙하 20배, 칸당 +1', () => {
    const e = engine();
    e.debugSetActive('O', 3, 2);
    const y0 = e.s.active!.y;
    e.setSoftDrop(true);
    run(e, 600, 10); // 1200/20 = 60ms 마다 한 칸 → 약 10칸
    const moved = e.s.active!.y - y0;
    expect(moved).toBeGreaterThanOrEqual(9);
    expect(moved).toBeLessThanOrEqual(10);
    expect(e.s.score).toBe(moved);
  });
});

describe('보관(홀드)은 조각당 1회 (M1 완료 기준 6)', () => {
  it('보관 → 다음 조각, 같은 조각에서 두 번째 보관은 무시, 잠근 뒤 다시 가능', () => {
    const e = engine();
    const first = e.s.active!.type;
    const next0 = e.s.queue[0];
    expect(e.hold()).toBe(true);
    expect(e.s.hold).toBe(first);
    expect(e.s.active!.type).toBe(next0);
    expect(e.hold()).toBe(false);
    expect(e.s.hold).toBe(first);
    e.hardDrop();
    expect(e.s.holdUsed).toBe(false);
    const cur = e.s.active!.type;
    expect(e.hold()).toBe(true);
    expect(e.s.active!.type).toBe(first); // 바꿔 넣기
    expect(e.s.hold).toBe(cur);
  });
});

describe('게임 오버 (§6.1)', () => {
  it('등장 위치가 막히면', () => {
    const e = engine();
    // 맨 위 두 줄(숨김)의 가운데를 막고, 나머지는 비운다
    const rows: (Cell | null)[][] = Array.from({ length: 18 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => (y < 2 && x >= 2 && x <= 5 ? { pieceId: 500 + y, type: 'L' as PieceType } : null)),
    );
    e.debugLoadRows(rows);
    e.debugSetActive('O', 5, 10);
    e.drainEvents();
    e.hardDrop(); // 잠그고 다음 조각 등장 → 막힘
    expect(e.s.phase).toBe('gameover');
    expect(e.drainEvents().find((x) => x.type === 'gameOver')).toMatchObject({ reason: 'blockOut' });
  });
  it('조각 전체가 보이는 영역 위(y<2)에서 잠기면', () => {
    const e = engine();
    // 2~17줄을 0열만 비우고 채운다 → O 가 0~1줄에 걸려 잠긴다
    const rows = Array.from({ length: 16 }, (_, i) => [null, ...Array.from({ length: 7 }, () => ({ pieceId: 900 + i, type: 'S' as PieceType }))]);
    e.debugLoadRows(rows);
    e.debugSetActive('O', 3, 0);
    e.drainEvents();
    run(e, LOCK_DELAY_MS + 50);
    const ev = e.drainEvents();
    expect(ev.find((x) => x.type === 'gameOver')).toMatchObject({ reason: 'lockOut' });
  });
});

describe('마디 완성 → 지우기 연출 300ms → 다음 조각', () => {
  it('연출 동안 새 조각이 나오지 않고 입력은 받아 둔다(회전은 다음 조각에 적용)', () => {
    const e = engine();
    e.debugLoadRows([row('_ O1 O1 O2 O2 O3 O3 Z1')]);
    e.debugSetActive('I', -2, 10, 1);
    e.drainEvents();
    e.hardDrop();
    expect(e.s.phase).toBe('clearing');
    expect(e.s.active).toBeNull();
    expect(e.rotate(1)).toBe(false); // 받아 둠
    run(e, CLEAR_ANIM_MS - 20);
    expect(e.s.active).toBeNull();
    run(e, 40);
    expect(e.s.active).not.toBeNull();
    expect(e.s.active!.rotation === 1 || e.s.active!.type === 'O').toBe(true);
  });

  it('4줄 동시 완성: 줄마다 따로 판정, 위→아래 순서, 기본 800×레벨 (§18 케이스 12, M1 기준 3)', () => {
    const e = engine({ startLevel: 2 });
    fourLineSetup(e);
    e.hardDrop();
    const [c] = clears(e.drainEvents());
    expect(c.rows).toEqual([14, 15, 16, 17]);
    expect(c.results.map((r) => r.y)).toEqual([14, 15, 16, 17]);
    expect(c.results.every((r) => r.complete)).toBe(true);
    const group = c.items.find((i) => i.kind === 'lines')!;
    expect(group).toMatchObject({ label: '작은악절!', points: 800 * 2 });
    expect(c.items.some((i) => i.kind === 'measure')).toBe(false);
    // 줄마다의 판정은 analyzeRow 와 같다
    const again = analyzeRow(c.board[15], e.s.meter, RULES_ALL, { level: 2 });
    expect(c.results[1].notes).toEqual(again.notes);
    run(e, CLEAR_ANIM_MS + 20);
    expect(e.s.board.slice(14).every((r) => r.every((x) => x === null))).toBe(true);
    expect(e.s.measuresCleared).toBe(4);
  });

  it('2줄 = 동기 300×레벨, 3줄 = 500×레벨', () => {
    for (const [n, label, pts] of [
      [2, '동기!', 300],
      [3, '3마디 동시!', 500],
    ] as const) {
      const e = engine();
      const rows = Array.from({ length: n }, (_, i) => [null, ...row(`T${i + 1} T${i + 1} Z${i + 1} Z${i + 1} L${i + 1} L${i + 1} S${i + 1}`)]);
      e.debugLoadRows(rows);
      e.debugSetActive('I', -2, 2, 1);
      e.hardDrop();
      const [c] = clears(e.drainEvents());
      expect(c.rows).toHaveLength(n);
      expect(c.items[0]).toMatchObject({ label, points: pts });
    }
  });

  it('합계 = 항목의 합, 점수에 그대로 더해진다', () => {
    const e = engine();
    fourLineSetup(e);
    const before = e.s.score;
    e.hardDrop();
    const ev = e.drainEvents();
    const [c] = clears(ev);
    const drop = ev.find((x) => x.type === 'hardDrop') as { cells: number };
    expect(c.total).toBe(c.items.reduce((s, i) => s + i.points, 0));
    expect(e.s.score - before).toBe(c.total + drop.cells * 2);
  });

  it('패턴 첫 달성은 1회만 500점 — 같은 판의 두 번째는 100점 (M5)', () => {
    const e = engine();
    // 두 줄 모두 q4 가 되도록: 0열을 비우고 I 세로로 채우면 [1,...] 이 되어 q4 가 아니다 → 대신 O 두 개로 맨 오른쪽 2열을 채운다
    e.debugLoadRows([row('O1 O1 O2 O2 O3 O3 _ _'), row('T1 T1 T2 T2 T3 T3 _ _')]);
    e.debugSetActive('O', 5, 2); // O 는 상자 1·2열 → 6·7열
    e.hardDrop();
    const [c] = clears(e.drainEvents());
    expect(c.results.map((r) => r.patternId)).toEqual(['q4', 'q4']);
    const pat = c.items.filter((i) => i.kind === 'patternNew' || i.kind === 'pattern').map((i) => i.points);
    expect(pat).toEqual([500, 100]);
    expect(c.newPatterns).toEqual(['4/4:q4']);
    expect(e.patternCounts['4/4:q4']).toBe(2);
  });

  it('도감에 이미 있으면 처음부터 100점 (저장된 도감을 넘겨받음)', () => {
    const e = new RhythmEngine({ mode: 'endless', stage: stage(), seed: 1, patterns: { '4/4:q4': 3 } });
    e.start();
    e.debugLoadRows([row('O1 O1 O2 O2 O3 O3 _ _'), row('T1 T1 T2 T2 T3 T3 _ _')]);
    e.debugSetActive('O', 5, 2); // O 는 상자 1·2열 → 6·7열
    e.hardDrop();
    const [c] = clears(e.drainEvents());
    expect(c.items.filter((i) => i.kind === 'patternNew')).toHaveLength(0);
    expect(c.newPatterns).toEqual([]);
  });

  it('스테이지 1(도감 닫힘)에서는 패턴 점수·등록이 없다', () => {
    const e = new RhythmEngine({ mode: 'campaign', stage: getStage(1), seed: 1 });
    e.start();
    e.debugLoadRows([row('O1 O1 O2 O2 O3 O3 _ _'), row('T1 T1 T2 T2 T3 T3 _ _')]);
    e.debugSetActive('O', 5, 2); // O 는 상자 1·2열 → 6·7열
    e.hardDrop();
    const [c] = clears(e.drainEvents());
    expect(c.items.some((i) => i.kind === 'patternNew' || i.kind === 'pattern')).toBe(false);
    expect(c.newPatterns).toEqual([]);
  });

  it('퍼펙트 클리어(보드가 빔) +1000', () => {
    const e = engine();
    // 가로 I 로 4칸 빈 줄을 채우면 보드가 완전히 빈다
    e.debugLoadRows([row('_ _ _ _ Z1 Z1 S1 S1')]);
    e.debugSetActive('I', 0, 10, 0);
    e.hardDrop();
    const [c] = clears(e.drainEvents());
    expect(c.perfect).toBe(true);
    expect(c.items.find((i) => i.kind === 'perfect')?.points).toBe(1000);
  });

  it('콤보: 연속 조각으로 연속 마디 완성 → +50 × 콤보 수, 끊기면 다시', () => {
    const e = engine();
    e.debugLoadRows([row('_ _ _ _ Z1 Z1 S1 S1'), row('_ _ _ _ Z2 Z2 S2 S2')]);
    e.debugSetActive('I', 0, 2, 0);
    e.hardDrop(); // 아랫줄 완성 (콤보 0)
    run(e, CLEAR_ANIM_MS + 20);
    e.debugSetActive('I', 0, 2, 0);
    run(e, 320); // 하드 드롭 보호 300ms
    e.hardDrop(); // 남은 줄 완성 (콤보 1)
    const cs = clears(e.drainEvents());
    expect(cs.map((c) => c.combo)).toEqual([0, 1]);
    expect(cs[1].items.find((i) => i.kind === 'combo')).toMatchObject({ label: '1 콤보', points: 50 });
    expect(e.s.stats.maxCombo).toBe(1);
  });
});

describe('레벨·스테이지 진행', () => {
  it('10마디마다 레벨 업, 낙하 간격이 표와 같다 (M3 기준 4)', () => {
    const e = engine();
    e.debugSetMeasures(9);
    expect(e.s.level).toBe(1);
    e.debugLoadRows([row('_ _ _ _ Z1 Z1 S1 S1')]);
    e.debugSetActive('I', 0, 10, 0);
    e.hardDrop();
    run(e, CLEAR_ANIM_MS + 20);
    expect(e.s.level).toBe(2);
    expect(e.s.dropIntervalMs).toBe(1000);
    expect(e.s.bpm).toBe(120);
  });
  it('6칸 보드는 같은 레벨에서 간격 × 1.3', () => {
    const e = engine({ meterId: '3/4' });
    expect(e.s.dropIntervalMs).toBe(1560);
  });
  it('목표 마디를 채우면 스테이지 클리어', () => {
    const e = engine({ targetMeasures: 2 }, 'campaign');
    e.debugSetMeasures(1);
    e.debugLoadRows([row('_ _ _ _ Z1 Z1 S1 S1')]);
    e.debugSetActive('I', 0, 10, 0);
    e.hardDrop();
    run(e, CLEAR_ANIM_MS + 20);
    expect(e.s.phase).toBe('stageClear');
    expect(e.drainEvents().some((x) => x.type === 'stageClear')).toBe(true);
  });
  it('스테이지 10: 15마디에서 5/4 → 7/8, 보드를 비운다', () => {
    const e = new RhythmEngine({ mode: 'campaign', stage: getStage(10), seed: 5 });
    e.start();
    expect(e.s.meter.id).toBe('5/4');
    expect(e.s.board[0]).toHaveLength(10);
    e.debugSetMeasures(14);
    e.debugLoadRows([row('_ _ _ _ Z1 Z1 S1 S1 T1 T1'), row('L1 L1 L1 J1 J1 J1 O1 O1 S2 S2')]);
    e.debugSetActive('I', 0, 2, 0);
    e.hardDrop();
    run(e, CLEAR_ANIM_MS + 20);
    const ev = e.drainEvents();
    expect(ev.find((x) => x.type === 'meterChange')).toBeTruthy();
    expect(e.s.meter.id).toBe('7/8');
    expect(e.s.board[0]).toHaveLength(7);
    expect(e.s.board.flat().every((c) => c === null)).toBe(true);
    expect(e.s.active).not.toBeNull();
  });
  it('일시정지 중에는 시간이 흐르지 않는다', () => {
    const e = engine();
    const y = e.s.active!.y;
    e.pause();
    run(e, 5000);
    expect(e.s.active!.y).toBe(y);
    e.resume();
    run(e, 1300);
    expect(e.s.active!.y).toBe(y + 1);
  });
});

describe('게임 오버 요약 숫자 = 실제 (§14-6, M8)', () => {
  it('완성 마디·음표 종류·당김음·화음·최고 마디가 판정 결과의 합과 같다', () => {
    const e = engine();
    fourLineSetup(e);
    e.hardDrop();
    const [c] = clears(e.drainEvents());
    const st = e.s.stats;
    expect(st.measures).toBe(4);
    const counts: Record<string, number> = { '8': 0, q: 0, qd: 0, h: 0, hd: 0, w: 0 };
    for (const r of c.results) for (const n of r.notation) counts[n.duration]++;
    expect(st.notesByDuration).toEqual(counts);
    expect(st.syncopations).toBe(c.results.reduce((s, r) => s + r.syncopationCount, 0));
    expect(st.chordMeasures).toBe(c.results.filter((r) => r.chord).length);
    expect(st.bestMeasure!.score).toBe(Math.max(...c.results.map((r) => r.score)));
    expect(st.newPatterns).toEqual(c.newPatterns);
  });
});

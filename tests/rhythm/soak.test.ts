// M1 완료 기준 (1) "10분 플레이에 오류 없음" + (4) "보드 폭을 6·9·12로 바꿔도 동작"
// 순수 엔진을 화면 없이 박자표마다 10분(가상 시간) 이상 돌린다. 입력은 무작위 + 줄을 지우려는 단순한 수(욕심쟁이)를 섞는다.
// 매 프레임 보드 불변식을 검사한다.
import { describe, expect, it } from 'vitest';
import { activeCells, cloneBoard, dropDistance, fits, fullRows, placePiece } from '@/lib/rhythm/board';
import { seededRng, type Rng } from '@/lib/rhythm/bag';
import { RhythmEngine } from '@/lib/rhythm/engine';
import { getStage, METERS } from '@/lib/rhythm/meters';
import { levelFor } from '@/lib/rhythm/speed';
import { BOARD_ROWS, type ActivePiece, type Board, type MeterId, type Rotation, type StageConfig } from '@/lib/rhythm/types';
import { RULES_ALL } from './helpers';

const FRAME = 16;
const TEN_MIN = 10 * 60 * 1000;

function endlessStage(meterId: MeterId, ties = false): StageConfig {
  return { id: 0, name: 'soak', meterId, rules: { ...RULES_ALL, ties }, targetMeasures: 0, startLevel: 1, card: { text: '', image: '' } };
}

/** 놓을 자리 평가: 지운 줄 많이, 구멍·높이·울퉁불퉁 적게 */
function evaluate(board: Board): number {
  const h = board.length;
  const w = board[0].length;
  const lines = fullRows(board).length;
  let holes = 0;
  let agg = 0;
  let bump = 0;
  let prev = -1;
  for (let x = 0; x < w; x++) {
    let top = h;
    for (let y = 0; y < h; y++) if (board[y][x]) { top = y; break; }
    const height = h - top;
    agg += height;
    if (prev >= 0) bump += Math.abs(height - prev);
    prev = height;
    for (let y = top + 1; y < h; y++) if (!board[y][x]) holes++;
  }
  return lines * 8 - holes * 4 - agg * 0.4 - bump * 0.3;
}

function bestTarget(e: RhythmEngine): { rotation: Rotation; x: number } | null {
  const p = e.s.active;
  if (!p) return null;
  let best: { rotation: Rotation; x: number; v: number } | null = null;
  for (const r of [0, 1, 2, 3] as Rotation[]) {
    for (let x = -3; x < e.s.meter.width + 1; x++) {
      const q: ActivePiece = { ...p, rotation: r, x };
      if (!fits(e.s.board, q)) continue;
      const landed = { ...q, y: q.y + dropDistance(e.s.board, q) };
      const b = cloneBoard(e.s.board);
      placePiece(b, landed);
      const v = evaluate(b);
      if (!best || v > best.v) best = { rotation: r, x, v };
    }
  }
  return best;
}

interface SoakReport {
  games: number;
  clears: number;
  multi: number;
  measures: number;
  maxLevel: number;
  frames: number;
}

/** 불변식 검사 — 매 프레임 부르므로 expect 대신 직접 비교하고, 어긋나면 바로 던진다 */
function checkInvariants(e: RhythmEngine, lastScore: number) {
  const s = e.s;
  const w = s.meter.width;
  const fail = (msg: string) => {
    throw new Error(`불변식 위반(${s.meter.id}, t=${e.clockMs}ms): ${msg}`);
  };
  if (s.board.length !== BOARD_ROWS) fail('보드 높이');
  const ids = new Map<number, number>();
  for (const r of s.board) {
    if (r.length !== w) fail('보드 폭');
    for (const c of r) {
      if (!c) continue;
      if (!(c.pieceId > 0) || !'IOTSZJL'.includes(c.type)) fail('칸 내용');
      ids.set(c.pieceId, (ids.get(c.pieceId) ?? 0) + 1);
    }
  }
  for (const n of ids.values()) if (n > 4) fail('한 조각이 4칸보다 많다');
  if (s.active) {
    if (!fits(s.board, s.active)) fail('조각이 블록과 겹친다');
    if (s.ghostY < s.active.y) fail('고스트가 조각보다 위');
    if (!fits(s.board, { ...s.active, y: s.ghostY })) fail('고스트 자리가 막혔다');
    if (fits(s.board, { ...s.active, y: s.ghostY + 1 })) fail('고스트가 바닥까지 안 내려갔다');
  }
  if (s.phase !== 'clearing' && fullRows(s.board).length) fail('지우지 않은 꽉 찬 줄');
  if (s.score < lastScore) fail('점수가 줄었다');
  if (s.stats.measures !== s.measuresCleared) fail('요약 마디 수');
  // 레벨 업은 지우기 연출이 끝난 뒤 적용된다
  if (!s.stage.meterSwitch && s.phase !== 'clearing' && s.level !== levelFor(s.stage.startLevel, s.measuresCleared)) fail('레벨');
  if (s.queue.length < 2) fail('다음 조각 2개');
}

function soak(make: (rng: Rng) => RhythmEngine, seed: number, totalMs = TEN_MIN): SoakReport {
  const rng = seededRng(seed);
  const rep: SoakReport = { games: 0, clears: 0, multi: 0, measures: 0, maxLevel: 0, frames: 0 };
  let e = make(rng);
  e.start();
  rep.games++;
  let lastScore = 0;
  let plan: { rotation: Rotation; x: number } | null = null;
  let planFor = -1;
  for (let t = 0; t < totalMs; t += FRAME) {
    rep.frames++;
    const p = e.s.active;
    // 조각마다 85% 는 욕심쟁이 수(한 프레임에 돌리고·옮기고·떨어뜨림), 15% 는 무작위 손가락
    if (p && p.id !== planFor) {
      planFor = p.id;
      plan = rng() < 0.85 ? bestTarget(e) : null;
    }
    if (plan && e.s.active) {
      for (let k = 0; k < 4 && e.s.active && e.s.active.rotation !== plan.rotation; k++) e.rotate(1);
      for (let k = 0; k < 14 && e.s.active && e.s.active.x < plan.x; k++) if (!e.move(1)) break;
      for (let k = 0; k < 14 && e.s.active && e.s.active.x > plan.x; k++) if (!e.move(-1)) break;
      if (e.s.active && !e.hardDrop()) e.setSoftDrop(true);
      else e.setSoftDrop(false);
    } else {
      const r = rng();
      if (r < 0.1) e.move(-1);
      else if (r < 0.2) e.move(1);
      else if (r < 0.25) e.rotate(1);
      else if (r < 0.3) e.rotate(-1);
      else if (r < 0.33) e.setSoftDrop(!e.isSoftDropping);
      else if (r < 0.35) e.hardDrop();
      else if (r < 0.37) e.hold();
      else if (r < 0.372) {
        e.pause();
        e.update(FRAME * 3); // 멈춘 동안 시간이 흘러도 그대로
        e.resume();
      }
    }
    e.update(FRAME);
    for (const ev of e.drainEvents()) {
      if (ev.type === 'clear') {
        rep.clears++;
        if (ev.clear.rows.length > 1) rep.multi++;
        rep.measures += ev.clear.rows.length;
        const cells = { '8': 1, q: 2, qd: 3, h: 4, hd: 6, w: 8 } as const;
        for (const r of ev.clear.results) {
          if (!r.complete) throw new Error('미완성 줄을 지웠다');
          if (r.notes.reduce((a, n) => a + n.length, 0) !== ev.clear.meter.width) throw new Error('음 길이 합 ≠ 마디');
          // 표기 길이의 합 = 마디 길이
          if (r.notation.reduce((a, n) => a + cells[n.duration], 0) !== ev.clear.meter.width) throw new Error('표기 길이 합 ≠ 마디');
        }
        if (ev.clear.total !== ev.clear.items.reduce((a, i) => a + i.points, 0)) throw new Error('점수 합계');
      }
    }
    checkInvariants(e, lastScore);
    lastScore = e.s.score;
    rep.maxLevel = Math.max(rep.maxLevel, e.s.level);
    if (e.s.phase === 'gameover' || e.s.phase === 'stageClear') {
      e = make(rng);
      e.start();
      rep.games++;
      lastScore = 0;
      planFor = -1;
    }
  }
  return rep;
}

describe('오래 돌리기(soak): 박자표마다 10분, 오류 없음·불변식 유지', () => {
  METERS.forEach((m, i) => {
    it(`${m.id} (${m.width}칸) 무한 모드 10분`, () => {
      const rep = soak((rng) => new RhythmEngine({ mode: 'endless', stage: endlessStage(m.id), rng }), 1000 + i * 31);
      expect(rep.frames * FRAME).toBeGreaterThanOrEqual(TEN_MIN);
      expect(rep.clears).toBeGreaterThan(20);
      // eslint-disable-next-line no-console
      console.log(`[soak ${m.id}] games=${rep.games} clears=${rep.clears} multi=${rep.multi} measures=${rep.measures} maxLevel=${rep.maxLevel}`);
    });
  });
  it('빠른 레벨(15부터, 간격 88ms·소프트 드롭 4ms)에서도 10분', () => {
    for (const id of ['4/4', '6/8', '12/8'] as MeterId[]) {
      const rep = soak((rng) => new RhythmEngine({ mode: 'endless', stage: { ...endlessStage(id), startLevel: 15 }, rng }), 9 + id.length);
      expect(rep.maxLevel).toBeGreaterThanOrEqual(15);
    }
  });
  it('4/4 붙임줄 규칙(스테이지 7) 10분', () => {
    const rep = soak((rng) => new RhythmEngine({ mode: 'endless', stage: endlessStage('4/4', true), rng }), 77);
    expect(rep.clears).toBeGreaterThan(20);
  });
  it('스테이지 1~10 캠페인을 이어서 10분 (스테이지 10은 5/4 → 7/8 전환)', () => {
    let next = 1;
    const rep = soak((rng) => {
      const s = getStage(((next++ - 1) % 10) + 1);
      return new RhythmEngine({ mode: 'campaign', stage: s, rng });
    }, 4242);
    expect(rep.games).toBeGreaterThan(1);
  });
});

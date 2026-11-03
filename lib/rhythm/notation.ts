// 표기(악보) 규칙 — 설계서 §8. 각 음(run)을 NotationNote[] 로 바꾼다.
//  8.1 길이 → 음표 (한 표기 묶음 안에서): 1=e 2=q 3=q. 4=h 5=h_e 6=h. 7=h._e 8=w
//  8.2 음이 표기 묶음 경계(가상 세로줄)를 넘으면 잘라서 붙임줄로 잇는다. 예외 (a)(b)(c)(d), strictNotation 이면 (c)(d)도 자른다.
import type { Duration, Meter, NotationNote, NoteEvent, Rules } from './types';

/** 8.1 표 */
const LENGTH_TO_DURATIONS: Record<number, Duration[]> = {
  1: ['8'],
  2: ['q'],
  3: ['qd'],
  4: ['h'],
  5: ['h', '8'],
  6: ['hd'],
  7: ['hd', '8'],
  8: ['w'],
};

export const DURATION_CELLS: Record<Duration, number> = { '8': 1, q: 2, qd: 3, h: 4, hd: 6, w: 8 };

/** 화면 이름(캡션·요약) */
export const DURATION_NAME: Record<Duration, string> = { '8': '8분', q: '4분', qd: '점4분', h: '2분', hd: '점2분', w: '온음표' };

/** 설계서 약어(e q q. h h. w) — 테스트·도감 표시용 */
export const DURATION_ABBR: Record<Duration, string> = { '8': 'e', q: 'q', qd: 'q.', h: 'h', hd: 'h.', w: 'w' };

/** 길이 → 음표들(붙임줄로 이어짐). 8칸보다 길면 온음표부터 채운다(붙임줄 규칙 대비) */
export function durationsForLength(length: number): Duration[] {
  if (length <= 0) return [];
  if (length <= 8) return LENGTH_TO_DURATIONS[length];
  return ['w', ...durationsForLength(length - 8)];
}

/** 표기 묶음 경계 칸. 4/4 [4,4] → [0,4,8] */
export function notationBoundaries(meter: Meter): number[] {
  const out = [0];
  for (const g of meter.notationGroups) out.push(out[out.length - 1] + g);
  return out;
}

/**
 * 음 하나를 어디서 자르는가(§8.2). 자를 칸 목록(경계 위치)을 돌려준다. 빈 배열 = 자르지 않음.
 */
export function cutPoints(start: number, length: number, meter: Meter, strict: boolean): number[] {
  const end = start + length;
  const bounds = notationBoundaries(meter);
  const inner = bounds.filter((b) => b > start && b < end);
  if (inner.length === 0) return [];
  // (b) 마디 전체를 덮으면 자르지 않는다
  if (start === 0 && end === meter.width) return [];
  // (a) 묶음 경계에서 시작해 묶음 경계에서 끝나면(묶음을 통째로 덮음) 자르지 않는다
  if (bounds.includes(start) && bounds.includes(end)) return [];
  if (!strict && meter.id === '4/4') {
    // (c) 뒷박(홀수 칸)에서 시작한 4분음표는 중간선을 넘어도 자르지 않는다 — 관용 당김음 `e q q q e`
    if (length === 2 && start % 2 === 1) return [];
    // (d) 2박에서 시작한 2분음표(칸 2~5)는 자르지 않는다 — 관용 표기 `q h q`
    if (length === 4 && start === 2) return [];
  }
  return inner;
}

/** 음(run) 하나 → 표기 음표들 */
export function noteToNotation(n: Pick<NoteEvent, 'pitch' | 'start' | 'length' | 'syncopated'>, meter: Meter, strict: boolean): NotationNote[] {
  const cuts = cutPoints(n.start, n.length, meter, strict);
  const edges = [n.start, ...cuts, n.start + n.length];
  const out: NotationNote[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    let pos = edges[i];
    for (const d of durationsForLength(edges[i + 1] - edges[i])) {
      out.push({ pitch: n.pitch, start: pos, duration: d, tieToNext: true, syncopated: n.syncopated });
      pos += DURATION_CELLS[d];
    }
  }
  if (out.length) out[out.length - 1].tieToNext = false;
  return out;
}

/** 마디 전체 → 표기 (§7-8) */
export function toNotation(notes: readonly NoteEvent[], meter: Meter, rules: Pick<Rules, 'strictNotation'>): NotationNote[] {
  return notes.flatMap((n) => noteToNotation(n, meter, rules.strictNotation));
}

/**
 * 표기를 설계서 약어 문자열로: 붙임줄은 `_`, 음표 사이는 공백.
 * 예) [q, e(tie)→e, q] → "q e_e q"
 */
export function notationText(notation: readonly NotationNote[]): string {
  let s = '';
  notation.forEach((n, i) => {
    s += DURATION_ABBR[n.duration];
    if (i < notation.length - 1) s += n.tieToNext ? '_' : ' ';
  });
  return s;
}

/** 길이(칸) → 이름. 붙임줄로만 적을 수 있는 길이는 '2분⁀8분' 처럼 */
export function lengthName(length: number): string {
  return durationsForLength(length)
    .map((d) => DURATION_NAME[d])
    .join('⁀');
}

/** 칸 길이 → 음표 배지 그림 이름(notes/note-*.svg). 한 기호로 못 적는 길이는 null */
export function lengthBadge(length: number): 'e' | 'q' | 'qd' | 'h' | 'hd' | 'w' | null {
  const m: Record<number, 'e' | 'q' | 'qd' | 'h' | 'hd' | 'w'> = { 1: 'e', 2: 'q', 3: 'qd', 4: 'h', 6: 'hd', 8: 'w' };
  return m[length] ?? null;
}

/** 캡션 앞부분: 음 길이를 차례로, 같은 것이 이어지면 ×n. 예) "2분 · 점4분 · 8분", "4분×4" */
export function rhythmCaption(notes: readonly Pick<NoteEvent, 'length'>[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < notes.length) {
    let j = i;
    while (j + 1 < notes.length && notes[j + 1].length === notes[i].length) j++;
    const name = lengthName(notes[i].length);
    const count = j - i + 1;
    parts.push(count > 1 ? `${name}×${count}` : name);
    i = j + 1;
  }
  return parts.join(' · ');
}

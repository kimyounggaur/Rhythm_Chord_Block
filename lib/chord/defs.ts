// 데이터(JSON) → 타입이 있는 정의. 화음 정의를 코드에 하드코딩하지 않는다(설계서 §16 주의 5):
// 화음·진행 보너스·점수표는 data/chord/chords.json(부록 A), 스테이지는 stages.json(부록 B), 퍼즐은 puzzles.json(부록 C).
import chordsJson from '@/data/chord/chords.json';
import stagesJson from '@/data/chord/stages.json';
import puzzlesJson from '@/data/chord/puzzles.json';
import type { Chord, ChordId, Goal, Pitch, Rules, StageConfig } from './types';

/** JSON·테스트 격자의 영문 → 계이름. 솔♯ 은 'G#' (격자 한 칸 표기는 '#') */
export const LETTER_TO_PITCH: Record<string, Pitch> = {
  C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시', 'G#': '솔♯', '#': '솔♯',
};
export const PITCH_TO_LETTER: Record<Pitch, string> = {
  도: 'C', 레: 'D', 미: 'E', 파: 'F', 솔: 'G', 라: 'A', 시: 'B', '솔♯': 'G#',
};
/** 격자 한 칸 글자(솔♯ 만 '#') */
export const PITCH_TO_CHAR: Record<Pitch, string> = { ...PITCH_TO_LETTER, '솔♯': '#' };

/** 모든 음(가중치 표 순서) */
export const ALL_PITCHES: readonly Pitch[] = ['도', '레', '미', '파', '솔', '라', '시', '솔♯'];

export function letterToPitch(l: string): Pitch {
  const p = LETTER_TO_PITCH[l];
  if (!p) throw new Error(`알 수 없는 음 표기: ${l}`);
  return p;
}

interface RawChord {
  id: string;
  name: string;
  tones: string[];
  root: string;
  requiredTones?: string[];
  fallback?: string;
  key: string;
  fn: string;
  roman: string;
  rank: number;
  color: string;
  art: { halo: string; badge: string; chip: string | null; burst: string; hint: string };
}

const CHORD_IDS: readonly ChordId[] = ['I', 'IV', 'V', 'V7', 'i', 'iv', 'Va'];
function asChordId(s: string): ChordId {
  if (!(CHORD_IDS as readonly string[]).includes(s)) throw new Error(`알 수 없는 화음: ${s}`);
  return s as ChordId;
}

function toChord(r: RawChord): Chord {
  return {
    id: asChordId(r.id),
    name: r.name,
    tones: r.tones.map(letterToPitch),
    root: letterToPitch(r.root),
    requiredTones: r.requiredTones?.map(letterToPitch),
    fallback: r.fallback ? asChordId(r.fallback) : undefined,
    key: r.key === 'a' ? 'a' : 'C',
    fn: r.fn as Chord['fn'],
    roman: r.roman,
    rank: r.rank,
    color: r.color,
    art: r.art as Chord['art'],
  };
}

export const CHORDS: Record<ChordId, Chord> = Object.fromEntries(
  (chordsJson.chords as RawChord[]).map((r) => {
    const c = toChord(r);
    return [c.id, c];
  }),
) as Record<ChordId, Chord>;

export function chordOf(id: ChordId): Chord {
  const c = CHORDS[id];
  if (!c) throw new Error(`화음 정의 없음: ${id}`);
  return c;
}

export interface ProgressionEntry {
  from: ChordId;
  to: ChordId;
  bonus: number;
  name: string;
  hint?: string;
  text?: string;
}
export const PROGRESSION_TABLE: ProgressionEntry[] = (
  chordsJson.progressionBonus as { from: string; to: string; bonus: number; name: string; hint?: string; text?: string }[]
).map((e) => ({ ...e, from: asChordId(e.from), to: asChordId(e.to) }));

export interface SequenceEntry {
  sequence: ChordId[];
  bonus: number;
  name: string;
}
export const SEQUENCE_TABLE: SequenceEntry[] = (chordsJson.sequenceBonus as { sequence: string[]; bonus: number; name: string }[]).map(
  (e) => ({ ...e, sequence: e.sequence.map(asChordId) }),
);

export const SCORE_TABLE = {
  chainPower: chordsJson.chainPower as number[],
  chainPowerStep: chordsJson.chainPowerStep as number,
  groupBonus: chordsJson.groupBonus as Record<string, number>,
  simul: chordsJson.simulBonus as { two: number; twoShared: number; three: number },
  allClear: chordsJson.allClear as number,
  collectionFirst: chordsJson.collectionFirst as number,
  collectionRepeat: chordsJson.collectionRepeat as number,
  attackDivisor: chordsJson.attackDivisor as number,
};

export interface CollectionDef {
  id: string;
  name: string;
  description: string;
  progression?: ChordId[];
  shared?: { chords: ChordId[]; pitch: Pitch };
  minSize?: number;
  extension?: boolean;
}
export const COLLECTION: CollectionDef[] = (
  chordsJson.collection as {
    id: string;
    name: string;
    description: string;
    progression?: string[];
    shared?: { chords: string[]; pitch: string };
    minSize?: number;
    extension?: boolean;
  }[]
).map((c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  progression: c.progression?.map(asChordId),
  shared: c.shared ? { chords: c.shared.chords.map(asChordId), pitch: letterToPitch(c.shared.pitch) } : undefined,
  minSize: c.minSize,
  extension: c.extension,
}));

// ── 스테이지(부록 B)
interface RawStage {
  id: number;
  name: string;
  startLevel: number;
  rules: {
    minGroup: number;
    activeChords: string[];
    weights: Record<string, number>;
    pairAffinity: number;
    hints: boolean;
    intervalLabel: boolean;
    garbage: { enabled: boolean; intervalSec: number; base: number; max: number };
    tensionPad: boolean;
  };
  goal: RawGoal | RawGoal[];
  card: { text: string; image: string };
}
interface RawGoal {
  type: string;
  chord?: string;
  progression?: string[];
  count: number;
}

function toGoal(g: RawGoal): Goal {
  return {
    type: g.type as Goal['type'],
    chord: g.chord ? asChordId(g.chord) : undefined,
    progression: g.progression?.map(asChordId),
    count: g.count,
  };
}

export function toRules(r: RawStage['rules']): Rules {
  const weights: Partial<Record<Pitch, number>> = {};
  for (const [k, v] of Object.entries(r.weights)) weights[letterToPitch(k)] = v;
  return {
    minGroup: r.minGroup,
    activeChords: r.activeChords.map(asChordId),
    weights,
    pairAffinity: r.pairAffinity,
    hints: r.hints,
    intervalLabel: r.intervalLabel,
    garbage: { ...r.garbage },
    tensionPad: r.tensionPad,
  };
}

export const STAGES: StageConfig[] = (stagesJson as RawStage[]).map((s) => ({
  id: s.id,
  name: s.name,
  startLevel: s.startLevel,
  rules: toRules(s.rules),
  goal: Array.isArray(s.goal) ? s.goal.map(toGoal) : toGoal(s.goal),
  card: { ...s.card },
}));

export function stageById(id: number): StageConfig {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`스테이지 없음: ${id}`);
  return s;
}

/** 목표를 늘 배열로 */
export function goalsOf(stage: StageConfig): Goal[] {
  return Array.isArray(stage.goal) ? stage.goal : [stage.goal];
}

// ── 연쇄 퍼즐(부록 C)
export interface PuzzleDef {
  id: string;
  title: string;
  stageMin: number;
  board: string[]; // 보이는 14줄, 위에서 아래로
  pairs: [Pitch, Pitch][]; // [축, 위성]
  activeChords: ChordId[];
  goal: { chain: number; progression?: ChordId[] };
  hint: string;
}
interface RawPuzzle {
  id: string;
  title: string;
  stageMin: number;
  board: string[];
  pairs: string[][];
  activeChords: string[];
  goal: { chain: number; progression?: string[] };
  hint: string;
}
export const PUZZLES: PuzzleDef[] = (puzzlesJson as RawPuzzle[]).map((p) => ({
  id: p.id,
  title: p.title,
  stageMin: p.stageMin,
  board: p.board,
  pairs: p.pairs.map((pr) => [letterToPitch(pr[0]), letterToPitch(pr[1])] as [Pitch, Pitch]),
  activeChords: p.activeChords.map(asChordId),
  goal: { chain: p.goal.chain, progression: p.goal.progression?.map(asChordId) },
  hint: p.hint,
}));

/** 퍼즐용 규칙(스테이지 3 기본값 위에 퍼즐의 활성 화음) */
export function puzzleRules(p: PuzzleDef): Rules {
  const base = stageById(3).rules;
  return { ...base, activeChords: p.activeChords, garbage: { ...base.garbage, enabled: false } };
}

/** 이 화음들이 쓰는 모든 음 */
export function activeTones(active: ChordId[]): Set<Pitch> {
  const s = new Set<Pitch>();
  for (const id of active) for (const t of chordOf(id).tones) s.add(t);
  return s;
}

/** 활성 화음 중 다른 화음의 fallback 으로 이미 판정되는 것(예: Ⅴ7 과 Ⅴ 가 함께 켜지면 Ⅴ 는 Ⅴ7 판정에 포함) */
export function judgedChords(active: ChordId[]): Chord[] {
  const defs = active.map(chordOf);
  const subsumed = new Set(defs.map((d) => d.fallback).filter(Boolean) as ChordId[]);
  return defs.filter((d) => !subsumed.has(d.id));
}

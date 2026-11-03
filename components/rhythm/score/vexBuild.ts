// NotationNote[] → VexFlow 음표·기·붙임줄 (설계서 §8.3·§8.4, M4). 화면(DOM)을 쓰지 않아 Vitest 에서 vexflow/core 로 검사한다.
// VexFlow 는 브라우저에서 vexflow/bravura 로 늦게 불러오고(§16 주의 1), 여기서는 그 네임스페이스를 인자로 받는다.
import type * as VexNS from 'vexflow';
import type { Meter, NotationNote } from '@/lib/rhythm/types';
import { VEX_KEY } from '@/lib/rhythm/types';

export type VF = typeof VexNS;
type StaveNote = InstanceType<VF['StaveNote']>;
type Beam = InstanceType<VF['Beam']>;
type StaveTie = InstanceType<VF['StaveTie']>;

export interface BuiltMeasure {
  notes: StaveNote[];
  beams: Beam[];
  ties: StaveTie[];
}

/**
 * 표기 음표 → StaveNote. 점음표는 Dot 을 붙이고, 8분음표는 박자표의 기 묶음(beamGroups)으로 Beam.generateBeams 에 넘긴다(§8.3).
 * restCells 가 있으면 빈칸을 쉼표로(악보 보기, §14-7) — 여기서는 쓰지 않는다.
 */
export function buildMeasure(vf: VF, notation: readonly NotationNote[], meter: Meter): BuiltMeasure {
  const notes = notation.map((n) => {
    const sn = new vf.StaveNote({ keys: [VEX_KEY[n.pitch]], duration: n.duration, autoStem: true, clef: 'treble' });
    if (n.duration === 'qd' || n.duration === 'hd') vf.Dot.buildAndAttach([sn], { all: true });
    return sn;
  });
  const groups = meter.beamGroups.map((g) => new vf.Fraction(g, 8));
  const beams = vf.Beam.generateBeams(notes, { groups });
  const ties: StaveTie[] = [];
  notation.forEach((n, i) => {
    if (n.tieToNext && notes[i + 1]) {
      ties.push(new vf.StaveTie({ firstNote: notes[i], lastNote: notes[i + 1], firstIndexes: [0], lastIndexes: [0] }));
    }
  });
  return { notes, beams, ties };
}

/** 기로 묶인 음표 번호 묶음(테스트·디버그용) */
export function beamIndexGroups(built: BuiltMeasure): number[][] {
  return built.beams.map((b) => b.getNotes().map((n) => built.notes.indexOf(n as StaveNote)));
}

/** VexFlow 박자표 문자열 — 박자표 이름 그대로(6/8 은 박이 2개지만 '6/8' 로 적는다) */
export function timeSigOf(meter: Meter): string {
  return meter.id;
}

/** 박자표의 분자·분모: '6/8' → { num: 6, den: 8 } (Voice 크기) */
export function timeSigParts(meter: Meter): { num: number; den: number } {
  const [num, den] = meter.id.split('/').map(Number);
  return { num, den };
}

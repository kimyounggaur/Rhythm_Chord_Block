// 박자표 상수(§4.2, 부록 A)와 스테이지 데이터(§12, 부록 C) 읽기
import metersJson from '@/data/rhythm/meters.json';
import stagesJson from '@/data/rhythm/stages.json';
import type { Meter, MeterId, Rules, StageConfig } from './types';

export const METERS: readonly Meter[] = metersJson as Meter[];

const byId = new Map<MeterId, Meter>(METERS.map((m) => [m.id, m]));

export function getMeter(id: MeterId): Meter {
  const m = byId.get(id);
  if (!m) throw new Error(`알 수 없는 박자표: ${id}`);
  return m;
}

/** 파일 이름 조각: '4/4' → '4-4' (board/board-4-4.svg) */
export function meterFileKey(id: MeterId): string {
  return id.replace('/', '-');
}

/** 박 길이(칸) 목록. 4/4 → [2,2,2,2], 7/8 → [2,2,3] */
export function beatLengths(meter: Meter): number[] {
  return meter.beatStarts.map((s, i) => (meter.beatStarts[i + 1] ?? meter.width) - s);
}

/** 모든 박의 길이가 같은가(7/8 만 아니다) */
export function hasUniformBeats(meter: Meter): boolean {
  const l = beatLengths(meter);
  return l.every((v) => v === l[0]);
}

/** 겹박자(6/8·9/8·12/8): 박 하나가 3칸 */
export function isCompound(meter: Meter): boolean {
  return meter.beatUnit === 8 && hasUniformBeats(meter) && beatLengths(meter)[0] === 3;
}

export const STAGES: readonly StageConfig[] = stagesJson as StageConfig[];

export function getStage(id: number): StageConfig {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`알 수 없는 스테이지: ${id}`);
  return s;
}

/** 스테이지에서 쓰는 박자표 전부(스테이지 10은 5/4 → 7/8) */
export function stageMeters(s: StageConfig): MeterId[] {
  return s.meterSwitch ? [s.meterId, s.meterSwitch.meterId] : [s.meterId];
}

export const BASE_RULES: Rules = {
  pitchSound: true,
  showSolfege: true,
  syncopationBonus: false,
  chordBonus: false,
  ties: false,
  strictNotation: false,
  beatColoring: false,
};

/**
 * 무한 모드(§12): 클리어한 스테이지의 박자표로 끝없이. 규칙은 그 박자표를 쓰는 '클리어한 스테이지'들의 규칙을 모두 켠다(배운 것 모두).
 * 시작 레벨 1, 목표 없음(레벨이 계속 오른다).
 */
export function endlessStage(meterId: MeterId, clearedStages: number[]): StageConfig {
  const rules: Rules = { ...BASE_RULES, pitchSound: false, showSolfege: false, patternBonus: true };
  let any = false;
  for (const s of STAGES) {
    if (!clearedStages.includes(s.id) || !stageMeters(s).includes(meterId)) continue;
    any = true;
    rules.pitchSound ||= s.rules.pitchSound;
    rules.showSolfege ||= s.rules.showSolfege;
    rules.syncopationBonus ||= s.rules.syncopationBonus;
    rules.chordBonus ||= s.rules.chordBonus;
    rules.ties ||= s.rules.ties;
    rules.beatColoring ||= s.rules.beatColoring;
  }
  if (!any) Object.assign(rules, BASE_RULES);
  // 무한 모드는 연습·점수 경쟁 — 도감은 늘 열려 있다(스테이지 1을 깨면 스테이지 2와 함께 도감이 열린다)
  rules.patternBonus = true;
  const art = STAGES.find((s) => stageMeters(s).includes(meterId));
  return {
    id: 0,
    name: '무한 모드',
    meterId,
    rules,
    targetMeasures: 0,
    startLevel: 1,
    card: { text: `${meterId} 박자로 끝없이! 레벨이 계속 올라가요.`, image: art?.card.image ?? 'stage1.svg' },
  };
}

/** 클리어한 스테이지로 무한 모드에 쓸 수 있는 박자표 */
export function endlessMeters(clearedStages: number[]): MeterId[] {
  const out: MeterId[] = [];
  for (const id of ['4/4', '3/4', '6/8', '9/8', '12/8', '5/4', '7/8'] as MeterId[]) {
    if (STAGES.some((s) => clearedStages.includes(s.id) && stageMeters(s).includes(id))) out.push(id);
  }
  return out;
}

// 주요3화음 공용 정의 — 리듬 모드의 '화음 마디'(리듬 설계서 §7-6)와 화음 모드가 같은 뜻으로 쓴다.
// 화음 모드의 전체 데이터(Ⅴ7·진행 보너스 등)는 data/chord/chords.json (화음 설계서 부록 A)에 있다.
import type { Solfege } from './solfege';

export type TriadId = 'I' | 'IV' | 'V';
export type ChordColorId = 'I' | 'IV' | 'V' | 'V7';

export interface Triad {
  id: TriadId;
  name: string;
  tones: Solfege[];
  root: Solfege;
}

export const PRIMARY_TRIADS: readonly Triad[] = [
  { id: 'I', name: '으뜸화음', tones: ['도', '미', '솔'], root: '도' },
  { id: 'IV', name: '버금딸림화음', tones: ['파', '라', '도'], root: '파' },
  { id: 'V', name: '딸림화음', tones: ['솔', '시', '레'], root: '솔' },
];

/** 화면에 쓰는 로마 숫자 */
export const ROMAN: Record<string, string> = { I: 'Ⅰ', IV: 'Ⅳ', V: 'Ⅴ', V7: 'Ⅴ7', i: 'ⅰ', iv: 'ⅳ' };

/** 화음 표시 색(테두리·배지) — 화음 설계서 §4.2 */
export const CHORD_COLOR: Record<ChordColorId, string> = { I: '#FFC107', IV: '#26A69A', V: '#AB47BC', V7: '#AB47BC' };

/**
 * 서로 다른 계이름이 2개 이상이고 모두 한 주요3화음에 들어가면 그 화음. (리듬 설계서 §7-6)
 * 두 음의 조합은 세 화음 중 최대 하나에만 속하므로 답은 하나뿐이다.
 */
export function triadOf(pitches: Solfege[]): TriadId | null {
  const distinct = Array.from(new Set(pitches));
  if (distinct.length < 2) return null;
  for (const t of PRIMARY_TRIADS) {
    if (distinct.every((p) => t.tones.includes(p))) return t.id;
  }
  return null;
}

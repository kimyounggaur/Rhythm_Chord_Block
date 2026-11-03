// 계이름·색·음정 — 리듬 모드와 화음 모드가 함께 쓰는 공용 정의 (두 설계서 §4 의 같은 값)

export type Solfege = '도' | '레' | '미' | '파' | '솔' | '라' | '시';
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const SOLFEGES: readonly Solfege[] = ['도', '레', '미', '파', '솔', '라', '시'];
export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const LETTER_TO_SOLFEGE: Record<Letter, Solfege> = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };
export const SOLFEGE_TO_LETTER: Record<Solfege, Letter> = { 도: 'C', 레: 'D', 미: 'E', 파: 'F', 솔: 'G', 라: 'A', 시: 'B' };

/** 도=0 … 시=6 (화음 설계서 §15 DEGREE) */
export const DEGREE: Record<Solfege, number> = { 도: 0, 레: 1, 미: 2, 파: 3, 솔: 4, 라: 5, 시: 6 };

/** 계이름 색 — 리듬 설계서 §4.3, 화음 설계서 §4.2 (두 문서가 같은 값) */
export const PITCH_COLOR: Record<Solfege, string> = {
  도: '#E53935', 레: '#FB8C00', 미: '#FDD835', 파: '#43A047', 솔: '#1E88E5', 라: '#3949AB', 시: '#8E24AA',
};

/** 에셋 파일 이름에 쓰는 영문 키 (예: tiles/tile-do-label.svg) */
export const ASSET_KEY: Record<Solfege, 'do' | 're' | 'mi' | 'fa' | 'sol' | 'la' | 'si'> = {
  도: 'do', 레: 're', 미: 'mi', 파: 'fa', 솔: 'sol', 라: 'la', 시: 'si',
};

/** Tone.js 음 이름. noteName('도', 4) → 'C4' */
export function noteName(s: Solfege, octave = 4): string {
  return `${SOLFEGE_TO_LETTER[s]}${octave}`;
}

/** 음정 숫자(1~7). 아래 음에서 위 음까지 센다: ((위 − 아래 + 7) % 7) + 1 — 화음 설계서 §4.4 */
export function intervalNumber(lower: Solfege, upper: Solfege): number {
  return ((DEGREE[upper] - DEGREE[lower] + 7) % 7) + 1;
}

/** "5도", 같은 음이면 "1도(같은 음)" */
export function intervalLabel(lower: Solfege, upper: Solfege): string {
  const k = intervalNumber(lower, upper);
  return k === 1 ? '1도(같은 음)' : `${k}도`;
}

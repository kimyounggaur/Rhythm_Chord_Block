// 테스트 도우미 — 설계서 §18 표기: `I1` = I 조각 개체 1, `_` = 빈칸
import { PIECE_TYPES, type Cell, type PieceType, type Rules } from '@/lib/rhythm/types';

/** "I1 I1 T1 _" → 칸 배열. 같은 글자·번호 = 같은 개체(pieceId) */
export function row(spec: string): (Cell | null)[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      if (tok === '_') return null;
      const type = tok[0] as PieceType;
      if (!PIECE_TYPES.includes(type)) throw new Error(`bad token ${tok}`);
      const n = Number(tok.slice(1) || '1');
      return { type, pieceId: (PIECE_TYPES.indexOf(type) + 1) * 1000 + n };
    });
}

/** §18 표를 판정할 때 쓰는 규칙: 당김음·화음 보너스 켬, 붙임줄 끔, 관용 표기 */
export const RULES_ALL: Rules = {
  pitchSound: true,
  showSolfege: true,
  syncopationBonus: true,
  chordBonus: true,
  ties: false,
  strictNotation: false,
  beatColoring: true,
};

export const RULES_STRICT: Rules = { ...RULES_ALL, strictNotation: true };
export const RULES_TIES: Rules = { ...RULES_ALL, ties: true };

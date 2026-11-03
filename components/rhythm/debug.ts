// 개발용 디버그 훅(window.__rhythmDebug) — 주소에 ?debug 가 있을 때만 켠다. 스크린샷·수동 점검용.
import { PIECE_TYPES, type Cell, type PieceType } from '@/lib/rhythm/types';

export function isDebug(): boolean {
  return typeof window !== 'undefined' && /[?&]debug\b/.test(window.location.search);
}

/** 설계서 §18 표기: "I1 I1 T1 _" (같은 글자·번호 = 같은 개체) */
export function parseRow(spec: string): (Cell | null)[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      if (tok === '_') return null;
      const type = tok[0] as PieceType;
      if (!PIECE_TYPES.includes(type)) throw new Error(`bad token ${tok}`);
      return { type, pieceId: 100000 + (PIECE_TYPES.indexOf(type) + 1) * 1000 + Number(tok.slice(1) || '1') };
    });
}

type DebugApi = Record<string, (...args: never[]) => unknown>;

export function exposeDebug(part: string, api: DebugApi): () => void {
  if (!isDebug()) return () => undefined;
  const w = window as unknown as { __rhythmDebug?: Record<string, unknown> };
  w.__rhythmDebug = { ...(w.__rhythmDebug ?? {}), [part]: api };
  return () => {
    if (w.__rhythmDebug) delete w.__rhythmDebug[part];
  };
}

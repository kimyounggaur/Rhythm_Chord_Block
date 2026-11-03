// 7-bag (§4.3): 7종을 한 묶음으로 섞어 모두 나온 뒤 다음 묶음을 섞는다.
import { PIECE_TYPES, type PieceType } from './types';

export type Rng = () => number;

/** 씨앗이 같으면 같은 수열 — 테스트·재현용 (mulberry32) */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 7종을 섞은 새 묶음 (Fisher–Yates) */
export function newBag(rng: Rng): PieceType[] {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** 묶음에서 하나 꺼낸다. 묶음이 비면 새로 섞는다. (bag 배열을 바꾼다) */
export function drawFromBag(bag: PieceType[], rng: Rng): PieceType {
  if (bag.length === 0) bag.push(...newBag(rng));
  return bag.shift()!;
}

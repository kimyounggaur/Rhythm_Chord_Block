// 조각 7종과 SRS 회전·월킥 — 설계서 §4.3 "SRS 표준 회전 상태와 월킥 표(공개된 표 그대로 사용)".
// 좌표: x 오른쪽 +, y 아래쪽 + (보드와 같음). 공개된 월킥 표는 y 위쪽 + 라서 여기서 y 부호를 뒤집어 적용한다.
import type { PieceType, Rotation } from './types';

export type XY = readonly [number, number];

/** 상태 0(등장 모양)의 칸. I 는 4×4 상자, O 는 4×3 상자의 가운데 두 칸, 나머지는 3×3 상자 */
const SPAWN_SHAPES: Record<PieceType, XY[]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

/** 회전 상자 크기 */
export const BOX_SIZE: Record<PieceType, number> = { I: 4, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

function rotateCW(cells: XY[], size: number): XY[] {
  // 상자 안에서 시계 방향 90°: (x, y) → (size−1−y, x)
  return cells.map(([x, y]) => [size - 1 - y, x] as const);
}

function sortCells(cells: XY[]): XY[] {
  return [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** SHAPES[type][rotation] = 상자 안 칸 4개 */
export const SHAPES: Record<PieceType, XY[][]> = Object.fromEntries(
  (Object.keys(SPAWN_SHAPES) as PieceType[]).map((t) => {
    const states: XY[][] = [];
    let cur = SPAWN_SHAPES[t];
    for (let r = 0; r < 4; r++) {
      states.push(sortCells(t === 'O' ? SPAWN_SHAPES.O : cur));
      cur = rotateCW(cur, BOX_SIZE[t]);
    }
    return [t, states];
  }),
) as Record<PieceType, XY[][]>;

/**
 * SRS 월킥 표 (공개된 표: x 오른쪽 +, y 위쪽 +). 키 = `${from}>${to}`, 상태 0·R(1)·2·L(3).
 * 다섯 가지 후보를 차례로 시험해 처음 들어가는 자리로 회전한다.
 */
const KICKS_JLSTZ: Record<string, XY[]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const KICKS_I: Record<string, XY[]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

/** 회전 시험 순서. 반환값은 보드 좌표계(y 아래 +)의 이동량 */
export function kickTests(type: PieceType, from: Rotation, to: Rotation): XY[] {
  if (type === 'O') return [[0, 0]];
  const table = type === 'I' ? KICKS_I : KICKS_JLSTZ;
  const list = table[`${from}>${to}`];
  if (!list) return [[0, 0]];
  return list.map(([dx, dyUp]) => [dx, 0 - dyUp] as const);
}

/** 조각이 보드에서 차지하는 칸(상자 왼쪽 위 = x, y) */
export function pieceCells(type: PieceType, rotation: Rotation, x: number, y: number): XY[] {
  return SHAPES[type][rotation].map(([cx, cy]) => [x + cx, y + cy] as const);
}

/** 등장 위치: 가로 중앙, y=0~1 (§4.3). 짝수 폭에서 3칸 조각은 왼쪽으로 반올림 */
export function spawnX(type: PieceType, width: number): number {
  return Math.floor((width - BOX_SIZE[type]) / 2);
}

export function nextRotation(r: Rotation, dir: 1 | -1): Rotation {
  return (((r + dir) % 4) + 4) % 4 as Rotation;
}

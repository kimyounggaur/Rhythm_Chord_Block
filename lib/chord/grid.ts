// 텍스트 격자 ↔ 보드 (설계서 §17 M2 "텍스트 격자(§18 표기) ↔ 보드 변환 함수(테스트용)")
// 표기: 영문 계이름 C D E F G A B, 솔♯ = '#', 비화음(방해) = 'X', 빈칸 = '.'. 띄어쓰기는 무시한다.
// 줄은 위에서 아래로 적되 **마지막 줄이 바닥(y=14)** 이다. 14줄보다 적으면 아래에 붙는다. 15줄이면 첫 줄이 숨김 줄(y=0).
import { COLS, ROWS, emptyBoard } from './board';
import { LETTER_TO_PITCH, PITCH_TO_CHAR } from './defs';
import type { Board } from './types';

export function parseGrid(rows: string[], startId = 1): { board: Board; nextId: number } {
  const lines = rows.map((r) => r.replace(/\s+/g, '')).filter((r) => r.length > 0);
  if (lines.length > ROWS) throw new Error(`격자 줄이 너무 많아요: ${lines.length}`);
  const board = emptyBoard();
  let id = startId;
  const top = ROWS - lines.length;
  lines.forEach((line, i) => {
    if (line.length !== COLS) throw new Error(`격자 한 줄은 ${COLS}칸이어야 해요: "${line}"`);
    const y = top + i;
    for (let x = 0; x < COLS; x++) {
      const ch = line[x];
      if (ch === '.') continue;
      if (ch === 'X') board[y][x] = { id: id++, kind: 'garbage', pitch: null };
      else {
        const p = LETTER_TO_PITCH[ch];
        if (!p) throw new Error(`알 수 없는 칸 글자: ${ch}`);
        board[y][x] = { id: id++, kind: 'note', pitch: p };
      }
    }
  });
  return { board, nextId: id };
}

/** 보드 → 격자 글자(기본: 보이는 14줄) */
export function boardToGrid(b: Board, includeHidden = false): string[] {
  const out: string[] = [];
  for (let y = includeHidden ? 0 : 1; y < ROWS; y++) {
    let s = '';
    for (let x = 0; x < COLS; x++) {
      const t = b[y][x];
      s += !t ? '.' : t.kind === 'garbage' ? 'X' : PITCH_TO_CHAR[t.pitch!];
    }
    out.push(s);
  }
  return out;
}

/** 위쪽 빈 줄을 빼고 보여 준다(테스트 실패 메시지용) */
export function boardToText(b: Board): string {
  const rows = boardToGrid(b, true);
  const first = rows.findIndex((r) => r !== '.'.repeat(COLS));
  return (first < 0 ? [] : rows.slice(first)).join('\n');
}

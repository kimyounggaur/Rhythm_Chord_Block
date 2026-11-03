// 리듬 에셋 경로(public/assets/rhythm/…) — docs/rhythm-assets-README.md
import { ASSET_KEY } from '@/lib/music/solfege';
import { meterFileKey } from '@/lib/rhythm/meters';
import { lengthBadge } from '@/lib/rhythm/notation';
import { PITCH_MAP, PIECE_TYPES, type MeterId, type PieceType, type Solfege } from '@/lib/rhythm/types';

export const R = (p: string) => `rhythm/${p}`;

/** 계이름 타일(-label = 글자 포함). 스테이지 1은 글자 없는 그림 */
export function tileArt(type: PieceType, label: boolean): string {
  return R(`tiles/tile-${ASSET_KEY[PITCH_MAP[type]]}${label ? '-label' : ''}.svg`);
}

export function ghostArt(type: PieceType): string {
  return R(`tiles/ghost-${ASSET_KEY[PITCH_MAP[type]]}.svg`);
}

/** k칸 알약(2·3·4). 더 길면 null — 4칸 알약을 늘려 쓴다(border-image) */
export function pillArt(pitch: Solfege, length: number, label: boolean): string | null {
  if (length < 2 || length > 4) return null;
  return R(`pills/pill-${ASSET_KEY[pitch]}-${length}${label ? '-label' : ''}.svg`);
}

export function pitchTileArt(pitch: Solfege, label: boolean): string {
  return R(`tiles/tile-${ASSET_KEY[pitch]}${label ? '-label' : ''}.svg`);
}

/** 음표 배지(notes/note-*.svg). 한 기호로 못 적는 길이(5·7)는 null */
export function noteBadgeArt(length: number): string | null {
  const b = lengthBadge(length);
  return b ? R(`notes/note-${b}.svg`) : null;
}

export function boardArt(meterId: MeterId, beats: boolean): string {
  return R(`board/board-${meterFileKey(meterId)}${beats ? '-beats' : ''}.svg`);
}

export function beatNumArt(meterId: MeterId): string {
  return R(`board/beatnum-${meterFileKey(meterId)}.svg`);
}

export function stageArt(image: string): string {
  return R(`stages/${image}`);
}

/** 미리 불러 둘 그림(게임 중 타일이 늦게 뜨는 깜박임 방지) */
export function gameArtList(meterIds: MeterId[]): string[] {
  const out: string[] = [];
  for (const t of PIECE_TYPES) {
    out.push(tileArt(t, true), tileArt(t, false), ghostArt(t));
    for (const len of [2, 3, 4]) out.push(pillArt(PITCH_MAP[t], len, true)!, pillArt(PITCH_MAP[t], len, false)!);
  }
  for (const b of ['e', 'q', 'qd', 'h', 'hd', 'w']) out.push(R(`notes/note-${b}.svg`));
  for (const m of meterIds) out.push(boardArt(m, false), boardArt(m, true), beatNumArt(m));
  for (const c of ['left', 'right', 'rotate-cw', 'rotate-ccw', 'soft-drop', 'hard-drop', 'hold']) {
    out.push(R(`controls/ctrl-${c}.svg`), R(`controls/ctrl-${c}-pressed.svg`));
  }
  out.push(R('fx/fx-line-flash.svg'), R('fx/fx-sparkle-gold.svg'), R('fx/fx-burst.svg'));
  for (const b of ['sync', 'chord', 'combo', 'pattern', 'perfect']) out.push(R(`badges/badge-${b}.svg`));
  return out;
}

// 화음 모드 그림(public/assets/chord/…) 경로 — 에셋 README 의 파일 이름 규칙을 한곳에 모았다.
import { ASSET_KEY } from '@/lib/music/solfege';
import { chordOf } from '@/lib/chord/defs';
import type { ChordId, Pitch } from '@/lib/chord/types';

export function pitchKey(p: Pitch): string {
  return p === '솔♯' ? 'sol-sharp' : ASSET_KEY[p];
}

/** 타일 그림: 계이름 글자 포함(-label)이 기본, 지금 켜진 화음에 없는 음은 잠든 타일(-dim) */
export function tileArt(pitch: Pitch | null, dim = false): string {
  if (!pitch) return 'chord/tiles/tile-junk.svg';
  if (pitch === '솔♯') return 'chord/tiles/tile-sol-sharp-label.svg'; // 솔♯ 은 가단조에서만 나오고 늘 켜져 있다
  return `chord/tiles/tile-${pitchKey(pitch)}-${dim ? 'dim' : 'label'}.svg`;
}

export function haloArt(key: string): string {
  return `chord/groups/halo-${key}.svg`;
}

/** 에셋에 있는 힌트 배지(화음 색 3종 × 빠진 음 3개 + '+1') */
const HINT_FILES = new Set([
  'i-do', 'i-mi', 'i-sol', 'i-plus1',
  'iv-do', 'iv-fa', 'iv-la', 'iv-plus1',
  'v-re', 'v-si', 'v-sol', 'v-plus1',
]);

/** 힌트 배지 그림. 가단조처럼 그림이 없는 음이면 null(화면이 같은 모양으로 그린다) */
export function hintArt(chord: ChordId, missing: Pitch | null): string | null {
  const name = `${chordOf(chord).art.hint}-${missing ? pitchKey(missing) : 'plus1'}`;
  return HINT_FILES.has(name) ? `chord/hints/hint-${name}.svg` : null;
}

export function badgeArt(chord: ChordId): string {
  return `chord/chords/${chordOf(chord).art.badge}.svg`;
}

export function chipArt(chord: ChordId): string | null {
  const c = chordOf(chord).art.chip;
  return c ? `chord/chords/${c}.svg` : null;
}

/** 화음 칩 그림의 가로·세로(에셋 viewBox) */
export const CHIP_SIZE: Record<string, [number, number]> = {
  'chord-chip-i': [223, 48],
  'chord-chip-iv': [254, 48],
  'chord-chip-v': [224, 48],
  'chord-chip-v7': [264, 48],
};

export function burstArt(chord: ChordId): string {
  return `chord/fx/fx-burst-${chordOf(chord).art.burst}.svg`;
}

export function shardsArt(pitch: Pitch | null): string {
  if (!pitch) return 'chord/fx/fx-sparkle-white.svg';
  return `chord/fx/fx-shards-${pitch === '솔♯' ? 'sol' : ASSET_KEY[pitch]}.svg`;
}

export function intervalArt(n: number): string {
  return `chord/intervals/interval-${n}.svg`;
}

export function stageArt(id: number): string {
  return `chord/stages/chord-stage${id}.svg`;
}

export function collectionArt(id: string, unlocked: boolean): string {
  return unlocked ? `chord/collection/prog-${id}.svg` : 'chord/collection/prog-locked.svg';
}

export const PITCH_HEX: Record<Pitch, string> = {
  도: '#E53935', 레: '#FB8C00', 미: '#FDD835', 파: '#43A047', 솔: '#1E88E5', 라: '#3949AB', 시: '#8E24AA', '솔♯': '#00ACC1',
};

/** 미리 불러 둘 그림(게임 중 깜박임 방지) */
export function preloadList(): string[] {
  const pitches: Pitch[] = ['도', '레', '미', '파', '솔', '라', '시'];
  const list = [
    ...pitches.flatMap((p) => [tileArt(p), tileArt(p, true), shardsArt(p)]),
    tileArt('솔♯'),
    tileArt(null),
    ...['i', 'iv', 'v', 'v7', 'i-iv', 'i-v', 'i-v7', 'iv-v7'].map(haloArt),
    ...[...HINT_FILES].map((h) => `chord/hints/hint-${h}.svg`),
    ...[1, 2, 3, 4, 5, 6, 7].map(intervalArt),
    'chord/board/board-7x14.svg',
    'chord/board/mark-spawn-x.svg',
    'chord/fx/fx-tile-flash.svg',
    'chord/fx/fx-ring.svg',
    'chord/fx/fx-burst-i.svg',
    'chord/fx/fx-burst-iv.svg',
    'chord/fx/fx-burst-v.svg',
    'chord/ui/strip-bg.svg',
    'chord/ui/strip-bg-gold.svg',
    'chord/ui/strip-arrow.svg',
    'chord/ui/chain-badge.svg',
    'chord/ui/panel-next.svg',
    'chord/ui/panel-interval.svg',
    'chord/ui/hint-bar.svg',
    'chord/backgrounds/bg-game.svg',
    'chord/backgrounds/bg-game-tense.svg',
    'chord/chords/chord-badge-i.svg',
    'chord/chords/chord-badge-iv.svg',
    'chord/chords/chord-badge-v.svg',
    'chord/chords/chord-chip-i.svg',
    'chord/chords/chord-chip-iv.svg',
    'chord/chords/chord-chip-v.svg',
  ];
  return list;
}

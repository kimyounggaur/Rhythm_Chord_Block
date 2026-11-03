'use client';
// 화음 모드 입구 — 설계서 docs/chord-puyo-design-v0.1.md (/chord, 정적 배포본 #/chord)
// 화면: 시작 메뉴 · 스테이지(캠페인·무한) · 연쇄 퍼즐 · 진행 도감 · 설정 · 게임
import { useEffect } from 'react';
import { PhoneColumn } from '@/components/shell/PhoneColumn';
import { ToastHost } from '@/components/shell/Toast';
import { useUnlockOnFirstGesture } from '@/components/shell/SoundGate';
import { preloadTone } from '@/lib/music/audio';
import { preloadImages } from '@/lib/music/assets';
import { PUZZLES, STAGES } from '@/lib/chord/defs';
import { useChordStore, type Screen } from '@/store/chord';
import GameScreen from './GameScreen';
import { MenuScreen } from './MenuScreen';
import { CollectionScreen, PuzzleSelect, StageSelect } from './SelectScreens';
import { SettingsScreen } from './SettingsScreen';
import { CHORD_CSS } from './styles';

/** ?debug 일 때 주소로 바로 들어가기: ?debug&stage=3, ?debug&endless=3, ?debug&puzzle=p01, ?debug&screen=collection */
function debugEntry() {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams(window.location.search);
  if (!q.has('debug')) return;
  const st = useChordStore.getState();
  (window as unknown as Record<string, unknown>).__chordStore = useChordStore;
  const stage = Number(q.get('stage'));
  const endless = Number(q.get('endless'));
  const puzzle = q.get('puzzle');
  const screen = q.get('screen') as Screen | null;
  if (stage && STAGES.some((s) => s.id === stage)) st.startGame('campaign', stage);
  else if (endless && STAGES.some((s) => s.id === endless)) st.startGame('endless', endless);
  else if (puzzle && PUZZLES.some((p) => p.id === puzzle)) st.startGame('puzzle', 3, puzzle);
  else if (screen) st.go(screen);
}

export default function ChordApp() {
  const init = useChordStore((s) => s.init);
  const loaded = useChordStore((s) => s.loaded);
  const screen = useChordStore((s) => s.screen);
  const session = useChordStore((s) => s.session);
  useUnlockOnFirstGesture();

  useEffect(() => {
    init();
    preloadTone();
    preloadImages(['chord/backgrounds/bg-title.svg', 'chord/backgrounds/bg-game.svg', ...STAGES.map((s) => `chord/stages/chord-stage${s.id}.svg`)]);
    debugEntry();
  }, [init]);

  const inGame = screen === 'game' && session;
  return (
    <PhoneColumn background={inGame ? undefined : 'chord/backgrounds/bg-title.svg'}>
      <style>{CHORD_CSS}</style>
      {!loaded ? null : inGame ? (
        <GameScreen key={session.nonce} session={session} />
      ) : screen === 'stages' ? (
        <StageSelect />
      ) : screen === 'puzzles' ? (
        <PuzzleSelect />
      ) : screen === 'collection' ? (
        <CollectionScreen />
      ) : screen === 'settings' ? (
        <SettingsScreen />
      ) : (
        <MenuScreen />
      )}
      {!inGame && (
        <div className="cm-toasts pointer-events-none absolute inset-0">
          <ToastHost />
        </div>
      )}
    </PhoneColumn>
  );
}

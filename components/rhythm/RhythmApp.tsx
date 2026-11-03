'use client';
// 리듬 모드 입구 — CLAUDE.md 의 '리듬 모드 설계서' (한 줄 = 한 마디)
// 화면: 시작(스테이지 선택·무한 모드·도감·설정) → 시작 카드 → 게임 → 클리어/게임 오버 요약
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNav } from '@/lib/nav';
import { getAudioSettings, preloadTone, setMasterVolume, setMuted } from '@/lib/music/audio';
import { preloadImages } from '@/lib/music/assets';
import { endlessStage, getStage, METERS, STAGES } from '@/lib/rhythm/meters';
import type { MeterId, SaveData } from '@/lib/rhythm/types';
import { PhoneColumn } from '@/components/shell/PhoneColumn';
import { ToastHost } from '@/components/shell/Toast';
import { DEFAULT_SAVE, useRhythmSave } from '@/store/rhythm';
import { gameArtList } from './art';
import { CollectionScreen } from './CollectionScreen';
import { exposeDebug, isDebug } from './debug';
import { GameScreen, type Launch } from './GameScreen';
import { MenuScreen } from './MenuScreen';
import { RhythmStyles } from './RhythmStyles';
import { loadVex } from './score/vexLoader';
import { SettingsDialog } from './SettingsDialog';
import { useElementSize } from './useElementSize';

type Screen = 'menu' | 'game' | 'collection';

export default function RhythmApp() {
  const nav = useNav();
  const [screen, setScreen] = useState<Screen>('menu');
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useRhythmSave((s) => s.data.settings);
  const updateSettings = useRhythmSave((s) => s.updateSettings);
  const [debug] = useState(isDebug);
  const wrap = useRef<HTMLDivElement>(null);
  const size = useElementSize(wrap);

  useEffect(() => {
    // 저장본을 다시 읽고(다른 탭에서 바뀌었을 수도), 소리·그림을 미리 불러 둔다
    useRhythmSave.getState().reload();
    preloadTone().catch(() => undefined);
    preloadImages(gameArtList(METERS.map((m) => m.id))).catch(() => undefined);
    // 악보(VexFlow + Bravura 글꼴)도 메뉴에 있는 동안 미리 받아 둔다 — 첫 마디가 바로 그려지게
    loadVex().catch(() => undefined);
    // 이 모드의 음량·소리 끔 설정은 공용 출력에 걸리므로, 떠날 때 들어올 때의 값으로 되돌린다
    const prev = getAudioSettings();
    return () => {
      setMasterVolume(prev.volume);
      setMuted(prev.muted);
    };
  }, []);

  const startStage = useCallback((id: number) => {
    setLaunch({ key: Date.now(), mode: 'campaign', stage: getStage(id) });
    setScreen('game');
  }, []);

  const startEndless = useCallback((m: MeterId) => {
    setLaunch({ key: Date.now(), mode: 'endless', stage: endlessStage(m, useRhythmSave.getState().data.clearedStages) });
    setScreen('game');
  }, []);

  const restart = useCallback(() => {
    setLaunch((l) => (l ? { ...l, key: Date.now() } : l));
  }, []);

  const nextStage = useCallback(() => {
    setLaunch((l) => {
      if (!l) return l;
      const next = STAGES.find((s) => s.id === l.stage.id + 1);
      return next ? { key: Date.now(), mode: 'campaign', stage: next } : l;
    });
  }, []);

  const toMenu = useCallback(() => {
    setScreen('menu');
    setLaunch(null);
  }, []);

  useEffect(() => {
    if (!debug) return;
    return exposeDebug('app', {
      stage: (id: number) => startStage(id),
      endless: (m: MeterId) => startEndless(m),
      menu: () => toMenu(),
      collection: () => setScreen('collection'),
      settings: (open: boolean) => setSettingsOpen(open),
      save: () => useRhythmSave.getState().data,
      setSave: (d: Partial<SaveData>) => useRhythmSave.getState().replace({ ...structuredClone(DEFAULT_SAVE), ...d }),
    });
  }, [debug, startEndless, startStage, toMenu]);

  return (
    <PhoneColumn background="rhythm/backgrounds/bg-game.svg">
      <RhythmStyles />
      <div ref={wrap} className="relative h-full w-full">
        {screen === 'menu' && (
          <MenuScreen
            onStage={startStage}
            onEndless={startEndless}
            onCollection={() => setScreen('collection')}
            onSettings={() => setSettingsOpen(true)}
            onHome={() => nav.go('/')}
          />
        )}
        {screen === 'collection' && <CollectionScreen onBack={() => setScreen('menu')} width={size.w || 360} />}
        {screen === 'game' && launch && (
          <GameScreen
            key={launch.key}
            launch={launch}
            debug={debug}
            settingsOpen={settingsOpen}
            onMenu={toMenu}
            onHome={() => nav.go('/')}
            onRestart={restart}
            onNextStage={nextStage}
            openSettings={() => setSettingsOpen(true)}
          />
        )}
        <ToastHost />
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={updateSettings} />
    </PhoneColumn>
  );
}

'use client';
// "소리 켜기" — iOS 는 사용자 터치 전에는 소리가 나지 않는다(두 설계서 §9).
// 1) 화면이 뜨면 Tone.js 를 미리 불러 두고, 2) 화면 어디든 첫 터치 때 소리를 켠다, 3) 버튼으로도 켤 수 있다.
import { useEffect } from 'react';
import { preloadTone, unlockAudio, useAudioUnlocked } from '@/lib/music/audio';
import { asset } from '@/lib/music/assets';
import { cn } from '@/lib/utils';

export function useUnlockOnFirstGesture() {
  useEffect(() => {
    preloadTone();
    const on = () => {
      unlockAudio().catch(() => undefined);
    };
    window.addEventListener('pointerdown', on, { once: true, capture: true });
    window.addEventListener('keydown', on, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', on, { capture: true });
      window.removeEventListener('keydown', on, { capture: true });
    };
  }, []);
}

export function SoundGate({ className, iconBase = 'chord/icons' }: { className?: string; iconBase?: string }) {
  const unlocked = useAudioUnlocked();
  useUnlockOnFirstGesture();
  if (unlocked) return null;
  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio().catch(() => undefined);
      }}
      className={cn(
        'pop-in inline-flex items-center gap-2 rounded-full border-2 border-line bg-panel/90 py-1.5 pl-1.5 pr-4 text-lg text-ink shadow-[0_3px_0_rgba(0,0,0,.35)]',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset(`${iconBase}/icon-sound-on.svg`)} alt="" className="h-9 w-9" draggable={false} />
      소리 켜기
    </button>
  );
}

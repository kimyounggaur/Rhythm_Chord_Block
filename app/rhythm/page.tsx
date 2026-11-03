'use client';
// 리듬 모드 — 설계서: docs/rhythm-tetris-design-v0.1.md
// VexFlow·Tone.js 는 브라우저 전용이라 ssr:false 로 불러온다(설계서 §16 주의 1).
import dynamic from 'next/dynamic';
import { NextNav } from '../_components/NextNav';
import { LoadingScreen } from '@/components/shell/LoadingScreen';

const RhythmApp = dynamic(() => import('@/components/rhythm/RhythmApp'), { ssr: false, loading: () => <LoadingScreen /> });

export default function Page() {
  return (
    <NextNav>
      <RhythmApp />
    </NextNav>
  );
}

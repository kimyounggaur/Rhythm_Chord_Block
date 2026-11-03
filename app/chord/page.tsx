'use client';
// 화음 모드 — 설계서: docs/chord-puyo-design-v0.1.md
// Tone.js 는 브라우저 전용이라 ssr:false 로 불러온다(설계서 §16 주의 1).
import dynamic from 'next/dynamic';
import { NextNav } from '../_components/NextNav';
import { LoadingScreen } from '@/components/shell/LoadingScreen';

const ChordApp = dynamic(() => import('@/components/chord/ChordApp'), { ssr: false, loading: () => <LoadingScreen /> });

export default function Page() {
  return (
    <NextNav>
      <ChordApp />
    </NextNav>
  );
}

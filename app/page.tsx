'use client';
import dynamic from 'next/dynamic';
import { NextNav } from './_components/NextNav';
import { LoadingScreen } from '@/components/shell/LoadingScreen';

const Home = dynamic(() => import('@/components/shell/Home'), { ssr: false, loading: () => <LoadingScreen /> });

export default function Page() {
  return (
    <NextNav>
      <Home />
    </NextNav>
  );
}

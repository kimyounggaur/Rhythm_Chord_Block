'use client';
// Next.js 라우터로 화면 이동(게임 코드는 lib/nav 의 useNav() 만 쓴다)
import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { NavProvider, type Route } from '@/lib/nav';

export function NextNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const value = useMemo(
    () => ({
      go: (r: Route) => router.push(r === '/' ? '/' : `${r}/`),
      href: (r: Route) => (r === '/' ? '/' : `${r}/`),
    }),
    [router],
  );
  return <NavProvider value={value}>{children}</NavProvider>;
}

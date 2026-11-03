'use client';
// 화면 이동 — Next.js(라우트 /, /rhythm, /chord)와 바로 해 보기용 정적 배포본(#/rhythm 같은 해시 주소)이 같은 화면 코드를 쓰도록
// 이동 방법만 바꿔 끼운다. 게임 화면 코드는 next/* 를 직접 import 하지 않는다.
import { createContext, useContext, type ReactNode } from 'react';

export type Route = '/' | '/rhythm' | '/chord';

export interface Nav {
  go: (r: Route) => void;
  href: (r: Route) => string;
}

const fallback: Nav = {
  go: (r) => {
    window.location.href = r;
  },
  href: (r) => r,
};

const NavContext = createContext<Nav>(fallback);

export function NavProvider({ value, children }: { value: Nav; children: ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  return useContext(NavContext);
}

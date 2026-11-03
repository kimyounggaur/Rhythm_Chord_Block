// 바로 해 보기용 정적 배포본의 입구(Vite). Next.js 앱과 같은 화면 코드를 쓰고, 화면 이동만 해시 주소(#rhythm, #chord)로 한다.
// 빌드: npm run build:play  → artifact/dist/ (모든 경로가 상대 경로라 어떤 주소 아래에 올려도 열린다)
import '../app/globals.css';
import { StrictMode, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NavProvider, type Nav, type Route } from '@/lib/nav';
import { LoadingScreen } from '@/components/shell/LoadingScreen';

const Home = lazy(() => import('@/components/shell/Home'));
const RhythmApp = lazy(() => import('@/components/rhythm/RhythmApp'));
const ChordApp = lazy(() => import('@/components/chord/ChordApp'));

// 해시 주소는 '#rhythm', '#chord' 처럼 이름만 쓴다(공유 링크에 그대로 실리는 형식). '#/rhythm' 도 받아 준다.
function readRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h === 'rhythm' ? '/rhythm' : h === 'chord' ? '/chord' : '/';
}

function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const nav = useMemo<Nav>(
    () => ({
      go: (r) => {
        window.location.hash = r === '/' ? 'home' : r.slice(1);
      },
      href: (r) => (r === '/' ? '#home' : `#${r.slice(1)}`),
    }),
    [],
  );
  return (
    <NavProvider value={nav}>
      <Suspense fallback={<LoadingScreen />}>
        {route === '/rhythm' ? <RhythmApp key="rhythm" /> : route === '/chord' ? <ChordApp key="chord" /> : <Home key="home" />}
      </Suspense>
    </NavProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

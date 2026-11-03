// 에셋(SVG) 경로 — public/assets/{rhythm,chord}/... 에 있는 그림을 가리킨다.
// Next.js 에서는 '/assets/…', 바로 해 보기용 정적 배포본(artifact)에서는 './assets/…' 로 바뀐다(빌드 설정의 NEXT_PUBLIC_ASSET_BASE).
import type { Solfege } from './solfege';
import { ASSET_KEY } from './solfege';

const BASE: string = process.env.NEXT_PUBLIC_ASSET_BASE ?? '/';

/** asset('rhythm/tiles/tile-do-label.svg') → '/assets/rhythm/tiles/tile-do-label.svg' */
export function asset(path: string): string {
  return `${BASE}assets/${path}`;
}

/** 계이름 → 'do' 같은 파일 이름 조각 */
export function pitchKey(p: Solfege): string {
  return ASSET_KEY[p];
}

/** 그림을 미리 불러 둔다(게임 중에 타일이 늦게 뜨는 깜박임 방지). */
export function preloadImages(paths: string[]): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return Promise.all(
    paths.map(
      (p) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.decoding = 'async';
          img.src = asset(p);
        }),
    ),
  ).then(() => undefined);
}

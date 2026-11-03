// 바로 해 보기용 정적 배포본(Vite) 설정 — 화면 코드는 Next.js 앱과 같고, 결과물은 상대 경로만 쓴다.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here),
  base: './',
  // 개발 서버를 여러 개 띄울 때 캐시가 겹치지 않게 VITE_CACHE_DIR 로 따로 줄 수 있다
  cacheDir: process.env.VITE_CACHE_DIR ?? path.resolve(here, '../node_modules/.vite-play'),
  publicDir: path.resolve(here, '../public'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(here, '..') } },
  define: {
    'process.env.NEXT_PUBLIC_ASSET_BASE': JSON.stringify('./'),
    'process.env.NEXT_PUBLIC_BUILD_TARGET': JSON.stringify('play'),
  },
  build: {
    outDir: path.resolve(here, 'dist'),
    emptyOutDir: true,
    assetsDir: 'app',
    // 글꼴은 CSS 안에 data: 로 넣는다(정적 배포본을 올리는 곳이 글꼴 파일 주소를 막아도 보이도록). 나머지는 파일로 둔다
    assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? true : false),
    chunkSizeWarningLimit: 4000,
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  preview: { host: '127.0.0.1', port: 4173 },
});

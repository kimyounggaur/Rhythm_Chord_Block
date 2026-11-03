import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { SwRegister } from './_components/SwRegister';
import { THEME_BOOT_SCRIPT } from '@/lib/music/theme';

export const metadata: Metadata = {
  title: '음악이론 게임 (가칭)',
  description: '블록을 쌓으며 마디·박자·화음을 배우는 모바일 웹 게임 — 리듬 모드와 화음 모드',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: '음악 게임', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#12122F',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {children}
        <SwRegister />
      </body>
    </html>
  );
}

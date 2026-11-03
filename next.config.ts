import type { NextConfig } from 'next';

// 게임은 서버가 필요 없으므로 정적 사이트로 내보낸다(out/). Vercel·아무 정적 호스팅에 그대로 올릴 수 있고,
// PWA 오프라인 캐시도 단순해진다.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

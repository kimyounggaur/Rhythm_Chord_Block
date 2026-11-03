'use client';
// 에셋 그림 한 장. path 는 public/assets/ 아래 경로(예: 'chord/tiles/tile-do-label.svg')
import type { CSSProperties } from 'react';
import { asset } from '@/lib/music/assets';
import { cn } from '@/lib/utils';

export function AssetImg({
  path,
  alt = '',
  className,
  style,
  width,
  height,
}: {
  path: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  width?: number | string;
  height?: number | string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset(path)}
      alt={alt}
      draggable={false}
      decoding="async"
      width={typeof width === 'number' ? width : undefined}
      height={typeof height === 'number' ? height : undefined}
      className={cn('pointer-events-none select-none', className)}
      style={{ width, height, ...style }}
    />
  );
}

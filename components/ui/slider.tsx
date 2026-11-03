'use client';
// shadcn/ui 방식 슬라이더(Radix Slider) — 음량 조절 등
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root ref={ref} className={cn('relative flex h-8 w-full touch-none select-none items-center', className)} {...props}>
    <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-bg2">
      <SliderPrimitive.Range className="absolute h-full bg-gold" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-7 w-7 rounded-full border-4 border-gold bg-white shadow outline-none focus-visible:ring-4 focus-visible:ring-white/40" />
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';

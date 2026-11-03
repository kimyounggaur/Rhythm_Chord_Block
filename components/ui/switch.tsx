'use client';
// shadcn/ui 방식 켜기/끄기 스위치(Radix Switch)
import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-line bg-bg2 transition-colors data-[state=checked]:border-[#2f9e7c] data-[state=checked]:bg-mint disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

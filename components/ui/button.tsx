'use client';
// shadcn/ui 방식의 버튼(소스를 프로젝트에 두고 고쳐 쓰는 컴포넌트). 젤리 화풍에 맞춘 색 변형.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl leading-none transition-[transform,filter] duration-100 active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-45 select-none outline-none focus-visible:ring-4 focus-visible:ring-white/40',
  {
    variants: {
      variant: {
        default: 'bg-gold text-ink-dark shadow-[0_4px_0_#c98710] hover:brightness-105',
        pink: 'bg-pink text-white shadow-[0_4px_0_#c84d78] hover:brightness-105',
        mint: 'bg-mint text-ink-dark shadow-[0_4px_0_#2f9e7c] hover:brightness-105',
        sky: 'bg-sky text-ink-dark shadow-[0_4px_0_#3378c4] hover:brightness-105',
        secondary: 'bg-panel text-ink border-2 border-line shadow-[0_4px_0_rgba(0,0,0,.35)] hover:brightness-110',
        ghost: 'bg-transparent text-ink hover:bg-white/10',
      },
      size: {
        default: 'h-12 px-5 text-lg',
        sm: 'h-9 px-3 text-base rounded-xl',
        lg: 'h-14 px-7 text-xl',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';

export { buttonVariants };

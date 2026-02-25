'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import React, { memo } from 'react'

import { cn } from '@/lib/utils'

/** Base glow element styles for the larger outer glow */
const GLOW_OUTER_BASE =
  'absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/.5)_10%,_hsl(var(--primary)/0)_60%)] sm:h-[512px]'

/** Base glow element styles for the smaller inner glow */
const GLOW_INNER_BASE =
  'absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/.3)_10%,_hsl(var(--primary)/0)_60%)] sm:h-[256px]'

/** Additional style for centering the glow vertically */
const GLOW_CENTER_TRANSLATE = '-translate-y-1/2'

export const glowVariants = cva('absolute w-full', {
  variants: {
    variant: {
      top: 'top-0',
      above: '-top-32',
      bottom: 'bottom-0',
      below: '-bottom-32',
      center: 'top-[50%]',
    },
  },
  defaultVariants: {
    variant: 'top',
  },
})

interface GlowProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glowVariants> {}

/**
 * Decorative glowing background element with position variants.
 * Used in HeroSection and CTASection for visual flair.
 *
 * @example
 * <Glow variant="center" className="opacity-40" />
 */
export const Glow = memo(function Glow({
  className,
  variant,
  ref,
  ...props
}: GlowProps & { ref?: React.Ref<HTMLDivElement> }) {
  const outerGlowClassName =
    variant === 'center'
      ? `${GLOW_OUTER_BASE} ${GLOW_CENTER_TRANSLATE}`
      : GLOW_OUTER_BASE

  const innerGlowClassName =
    variant === 'center'
      ? `${GLOW_INNER_BASE} ${GLOW_CENTER_TRANSLATE}`
      : GLOW_INNER_BASE

  return (
    <div
      ref={ref}
      className={cn(glowVariants({ variant }), className)}
      {...props}
    >
      <div className={outerGlowClassName} />
      <div className={innerGlowClassName} />
    </div>
  )
})

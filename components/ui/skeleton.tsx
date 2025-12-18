/**
 * Skeleton Component
 *
 * A skeleton loading component for placeholder content while data loads.
 * - Pulse animation to indicate loading state
 * - Customizable sizes and shapes
 */

import { memo } from 'react'

import { cn } from '@/lib/utils'

const Skeleton = memo(function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
})

export { Skeleton }

import { memo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Theme card skeleton matching the theme grid layout.
 */
const ThemeCardSkeleton = memo(function ThemeCardSkeleton() {
  return <Skeleton className="h-20 w-full rounded-lg" />
})

/**
 * Loading skeleton for settings page.
 * Matches layout: header, then theme grid.
 */
const Loading = memo(function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      {/* Theme section */}
      <div className="mb-4">
        <Skeleton className="h-5 w-20" />
      </div>

      {/* Theme grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 14 }).map((_, i) => (
          <ThemeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
})

export default Loading

import { memo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Board card skeleton matching BoardCard component dimensions.
 */
const BoardCardSkeleton = memo(function BoardCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="size-6 rounded" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
})

/**
 * Loading skeleton for boards list page.
 * Matches layout: header with title + button, then 6-card grid.
 */
const Loading = memo(function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      {/* Board cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <BoardCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
})

export default Loading

import { memo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Card skeleton component for loading state.
 * Matches RepoCard dimensions with title and stats.
 */
const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-2 flex gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
})

/**
 * Column skeleton component for loading state.
 * Shows header with title area and variable number of card skeletons.
 * @param cardCount - Number of card skeletons to display
 */
const ColumnSkeleton = memo(function ColumnSkeleton({
  cardCount,
}: {
  cardCount: number
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 p-3">
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="size-6 rounded" />
      </div>
      {/* Cards */}
      <div className="space-y-2">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
})

/**
 * Loading skeleton for board detail page.
 * Matches KanbanBoard layout with header and 4 columns.
 */
const Loading = memo(function Loading() {
  // Varying card counts for visual variety
  const columnCardCounts = [3, 2, 1, 0]

  return (
    <div className="flex h-full flex-col">
      {/* Board header skeleton */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded" />
          <Skeleton className="size-8 rounded" />
          <Skeleton className="size-8 rounded" />
        </div>
      </div>

      {/* Kanban columns skeleton */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {columnCardCounts.map((count, i) => (
          <ColumnSkeleton key={i} cardCount={count} />
        ))}
      </div>
    </div>
  )
})

export default Loading

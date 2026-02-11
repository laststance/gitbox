import { memo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Maintenance item skeleton matching the repo card layout.
 */
const RepoItemSkeleton = memo(function RepoItemSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="size-8 rounded" />
      </div>
    </div>
  )
})

/**
 * Loading skeleton for maintenance page.
 * Matches layout: header with search/sort controls, then repo list.
 */
const Loading = memo(function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {/* Search and controls */}
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>

      {/* Repo list */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <RepoItemSkeleton key={i} />
        ))}
      </div>
    </div>
  )
})

export default Loading

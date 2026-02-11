import { memo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for account page.
 * Matches layout: profile section, data summary, danger zone.
 */
const Loading = memo(function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      {/* Profile section */}
      <div className="bg-card mb-6 rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>

      {/* Data summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div className="border-destructive/50 rounded-lg border p-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-2 h-4 w-64" />
        <Skeleton className="mt-4 h-10 w-36 rounded-md" />
      </div>
    </div>
  )
})

export default Loading

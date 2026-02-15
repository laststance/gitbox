import { memo } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for settings page.
 * Matches layout: header, then display settings card with 2 toggle rows.
 */
const Loading = memo(function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      {/* Display Settings card */}
      <div className="space-y-4 rounded-lg border p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-1 h-4 w-64" />
        {/* Toggle row 1 */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1 h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
        {/* Toggle row 2 */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1 h-3 w-52" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>
    </div>
  )
})

export default Loading

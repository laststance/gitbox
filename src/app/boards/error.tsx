'use client'

import { memo } from 'react'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const BoardsError = memo(function BoardsError(props: ErrorProps) {
  return (
    <RouteErrorFallback
      {...props}
      title="Failed to load boards"
      description="Could not load your boards. Please try again."
      secondaryLabel="Reload page"
    />
  )
})

export default BoardsError

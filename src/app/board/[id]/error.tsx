'use client'

import { memo } from 'react'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const BoardError = memo(function BoardError(props: ErrorProps) {
  return (
    <RouteErrorFallback
      {...props}
      title="Failed to load board"
      description="Could not load this board. It may have been deleted or you may not have access."
    />
  )
})

export default BoardError

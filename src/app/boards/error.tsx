'use client'

import * as Sentry from '@sentry/nextjs'
import { memo, useEffect } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Error boundary for boards list page.
 * Captures to Sentry and offers retry or home navigation.
 */
const BoardsError = memo(function BoardsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-semibold">
          Failed to load boards
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Could not load your boards. Please try again.
        </p>
        {error.digest && (
          <p className="text-muted-foreground mt-1 text-xs">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button
          onClick={() => (window.location.href = '/boards')}
          variant="outline"
        >
          Reload page
        </Button>
      </div>
    </div>
  )
})

export default BoardsError

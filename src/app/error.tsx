'use client'

import * as Sentry from '@sentry/nextjs'
import { memo, useEffect } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error boundary for the application.
 * Captures exceptions to Sentry and provides recovery options.
 */
const Error = memo(function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h1 className="text-foreground text-2xl font-semibold">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          An unexpected error occurred. Please try again.
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
          Go to Boards
        </Button>
      </div>
    </div>
  )
})

export default Error

'use client'

import * as Sentry from '@sentry/nextjs'
import { memo, useEffect } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Error boundary for account page.
 * Captures to Sentry and offers retry or navigation to boards.
 */
const AccountError = memo(function AccountError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h2 className="text-foreground text-xl font-semibold">
          Failed to load account
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Could not load your account information. Please try again.
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

export default AccountError

'use client'

import * as Sentry from '@sentry/nextjs'
import { memo, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants/routes'

interface RouteErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
  title: string
  description: string
  /** 'page' for full-screen (root error.tsx), 'section' for route-level (default). */
  variant?: 'page' | 'section'
  secondaryLabel?: string
}

/**
 * Shared UI for Next.js error boundaries.
 * Captures the error to Sentry and offers retry + navigation to Boards.
 */
export const RouteErrorFallback = memo(function RouteErrorFallback({
  error,
  reset,
  title,
  description,
  variant = 'section',
  secondaryLabel = 'Go to Boards',
}: RouteErrorFallbackProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const isPage = variant === 'page'
  const wrapperClass = isPage
    ? 'flex min-h-screen flex-col items-center justify-center gap-6 p-4'
    : 'flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4'
  const headingClass = isPage
    ? 'text-foreground text-2xl font-semibold'
    : 'text-foreground text-xl font-semibold'

  return (
    <div className={wrapperClass}>
      <div className="text-center">
        {isPage ? (
          <h1 className={headingClass}>{title}</h1>
        ) : (
          <h2 className={headingClass}>{title}</h2>
        )}
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>
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
          onClick={() => (window.location.href = ROUTES.BOARDS)}
          variant="outline"
        >
          {secondaryLabel}
        </Button>
      </div>
    </div>
  )
})

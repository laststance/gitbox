'use client'

import { memo } from 'react'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const Error = memo(function Error(props: ErrorProps) {
  return (
    <RouteErrorFallback
      {...props}
      variant="page"
      title="Something went wrong"
      description="An unexpected error occurred. Please try again."
    />
  )
})

export default Error

'use client'

import { memo } from 'react'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const MaintenanceError = memo(function MaintenanceError(props: ErrorProps) {
  return (
    <RouteErrorFallback
      {...props}
      title="Failed to load maintenance items"
      description="Could not load your maintenance repositories. Please try again."
    />
  )
})

export default MaintenanceError

'use client'

import { memo } from 'react'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const SettingsError = memo(function SettingsError(props: ErrorProps) {
  return (
    <RouteErrorFallback
      {...props}
      title="Failed to load settings"
      description="Could not load your settings. Please try again."
    />
  )
})

export default SettingsError

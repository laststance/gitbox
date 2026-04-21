'use client'

import { memo } from 'react'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

const AccountError = memo(function AccountError(props: ErrorProps) {
  return (
    <RouteErrorFallback
      {...props}
      title="Failed to load account"
      description="Could not load your account information. Please try again."
    />
  )
})

export default AccountError

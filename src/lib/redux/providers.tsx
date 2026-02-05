'use client'

/**
 * Redux Providers
 *
 * Client Component wrapper for Redux Provider
 * Next.js 13+ App Router requires Provider to be in a Client Component
 */

import { memo } from 'react'
import { Provider } from 'react-redux'

import { store } from './store'

export const Providers = memo(function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return <Provider store={store}>{children}</Provider>
})

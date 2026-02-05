'use client'

/**
 * Redux Provider
 *
 * Client Component wrapper for Redux Provider
 * Next.js App Router requires Provider to be in a Client Component
 */

import { memo } from 'react'
import { Provider } from 'react-redux'

import { store } from './store'

export const ReduxProvider = memo(function ReduxProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <Provider store={store}>{children}</Provider>
})

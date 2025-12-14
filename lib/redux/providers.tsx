'use client'

/**
 * Redux Providers
 *
 * Client Component wrapper for Redux Provider
 * Next.js 13+ App Router requires Provider to be in a Client Component
 */

import { Provider } from 'react-redux'
import { store } from './store'

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>
}

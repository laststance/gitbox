'use client'

/**
 * Redux Providers
 *
 * Client Component wrapper for Redux Provider
 * Next.js 13+ App Router requires Provider to be in a Client Component
 */

import { Provider } from 'react-redux'
import { store } from './store'
import { I18nProvider } from '@/lib/i18n'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <I18nProvider>
        {children}
      </I18nProvider>
    </Provider>
  )
}

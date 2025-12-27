/**
 * Internationalization Context
 *
 * Provides translation access throughout the app (English-only)
 */

'use client'

import React, { createContext, useContext, useMemo, memo } from 'react'

import { translations } from './translations'

interface I18nContextType {
  t: typeof translations.en
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

/**
 * Provider component that supplies English translations to the app.
 * @param children - React children to wrap with i18n context
 * @returns Provider component with English translations
 */
export const I18nProvider = memo(function I18nProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  const contextValue = useMemo(
    () => ({
      t: translations.en,
    }),
    [],
  )

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  )
})

/**
 * Hook to access i18n context with translations.
 * @returns Object containing English translations
 * @example
 * const { t } = useI18n()
 * return <h1>{t.common.loading}</h1>
 */
export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    // Return default values for SSR/pre-render
    return {
      t: translations.en,
    }
  }
  return context
}

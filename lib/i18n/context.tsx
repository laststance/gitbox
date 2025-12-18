/**
 * Internationalization Context
 *
 * Provides language switching and translation access throughout the app
 */

'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  memo,
} from 'react'

import type { Language } from './translations'
import { translations } from './translations'

const LANGUAGE_STORAGE_KEY = 'gitbox-language'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (typeof translations)[Language]
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

// Helper to detect if we're in a browser environment
const getSnapshot = () => true
const getServerSnapshot = () => false
const subscribe = () => () => {}

export const I18nProvider = memo(function I18nProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  // Initialize language from localStorage (client-side only)
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en'
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null
    if (stored && (stored === 'en' || stored === 'ja')) {
      return stored
    }
    const browserLang = navigator.language.split('-')[0]
    return browserLang === 'ja' ? 'ja' : 'en'
  })

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [])

  // Memoize context value for stable reference
  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t: translations[language],
    }),
    [language, setLanguage],
  )

  // Show children with default English until client-side hydration
  if (!isClient) {
    return children
  }

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  )
})

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    // Return default values for SSR/pre-render
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: translations.en,
    }
  }
  return context
}

// Utility hook for just getting translations (simpler API)
export function useTranslation() {
  const { t, language } = useI18n()
  return { t, language }
}

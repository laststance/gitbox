/**
 * Theme Hook
 *
 * Custom hook providing theme switching functionality
 * Saves to LocalStorage and applies via data-theme attribute
 */

'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import {
  type ThemeType,
  ALL_THEMES,
  LIGHT_THEMES,
  DARK_THEMES,
  isDarkTheme,
} from '@/lib/constants/themes'

// Re-export types and constants for backward compatibility
export type { ThemeType }
export { ALL_THEMES, LIGHT_THEMES, DARK_THEMES, isDarkTheme }

// Helper to detect if we're in a browser environment
const getSnapshot = () => true
const getServerSnapshot = () => false
const subscribe = () => () => {}

const THEME_STORAGE_KEY = 'gitbox-theme'

export function useTheme() {
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  // Initialize theme from localStorage (client-side only)
  const [theme, setThemeState] = useState<ThemeType>(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null
    if (stored && ALL_THEMES.includes(stored)) {
      return stored
    }
    return 'system'
  })

  // Apply theme to document
  useEffect(() => {
    if (!isClient) return

    const root = document.documentElement

    // Remove previous theme
    ALL_THEMES.forEach((t) => {
      if (t !== 'system') {
        root.removeAttribute('data-theme')
      }
    })

    if (theme === 'system') {
      // Use system preference
      root.removeAttribute('data-theme')
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    } else {
      // Apply custom theme
      root.setAttribute('data-theme', theme)

      // Set dark class for dark themes
      if (isDarkTheme(theme)) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [theme, isClient])

  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme)
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
  }, [])

  return {
    theme,
    setTheme,
    isDark: isDarkTheme(theme),
    mounted: isClient,
  }
}

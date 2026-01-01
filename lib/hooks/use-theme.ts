/**
 * Theme Hook
 *
 * Custom hook providing theme switching functionality
 * Uses Redux for state management (persisted via Storage Middleware)
 * Applies theme via data-theme attribute and dark class
 */

'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

import {
  type ThemeType,
  ALL_THEMES,
  LIGHT_THEMES,
  DARK_THEMES,
  isDarkTheme,
} from '@/lib/constants/themes'
import {
  selectTheme,
  setTheme as setThemeAction,
} from '@/lib/redux/slices/settingsSlice'
import { useAppDispatch, useAppSelector } from '@/lib/redux/store'

// Re-export types and constants for backward compatibility
export type { ThemeType }
export { ALL_THEMES, LIGHT_THEMES, DARK_THEMES, isDarkTheme }

// Helper to detect if we're in a browser environment
const getSnapshot = () => true
const getServerSnapshot = () => false
const subscribe = () => () => {}

// Legacy localStorage key for migration
const LEGACY_THEME_STORAGE_KEY = 'gitbox-theme'

/**
 * Theme management hook using Redux
 * @returns Theme state and setter with DOM application
 * @example
 * const { theme, setTheme, isDark, mounted } = useTheme()
 * // theme: 'system' | 'sunrise' | 'midnight' | ...
 * // setTheme('midnight') - changes theme and persists via Redux Storage Middleware
 */
export function useTheme() {
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const dispatch = useAppDispatch()
  const theme = useAppSelector(selectTheme)

  // Migrate legacy localStorage theme to Redux (one-time migration)
  useEffect(() => {
    if (!isClient) return

    const legacyTheme = localStorage.getItem(
      LEGACY_THEME_STORAGE_KEY,
    ) as ThemeType | null

    if (legacyTheme && ALL_THEMES.includes(legacyTheme)) {
      // Only migrate if current Redux state is still default 'system'
      // This prevents overwriting a theme that was already set via Redux
      if (theme === 'system') {
        dispatch(setThemeAction(legacyTheme))
      }
      // Remove legacy key regardless (cleanup)
      localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
    }
  }, [isClient, theme, dispatch])

  // Apply theme to document
  useEffect(() => {
    if (!isClient) return

    const root = document.documentElement

    // Remove previous theme attribute
    root.removeAttribute('data-theme')

    if (theme === 'system') {
      // Use system preference
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

  const setTheme = useCallback(
    (newTheme: ThemeType) => {
      dispatch(setThemeAction(newTheme))
    },
    [dispatch],
  )

  return {
    theme,
    setTheme,
    isDark: isDarkTheme(theme),
    mounted: isClient,
  }
}

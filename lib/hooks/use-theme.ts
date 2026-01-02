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

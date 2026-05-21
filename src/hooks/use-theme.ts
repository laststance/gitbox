/**
 * Theme Hook
 *
 * Custom hook providing theme switching functionality
 * Uses Redux for state management (persisted via Storage Middleware)
 * Applies theme via data-theme attribute and dark class
 */

'use client'

import { useCallback, useEffect } from 'react'

import { useMounted } from '@/hooks/use-mounted'
import { useStorageHydrated } from '@/hooks/use-storage-hydrated'
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

/**
 * Theme management hook using Redux
 * @returns Theme state and setter with DOM application
 * @example
 * const { theme, setTheme, isDark, mounted } = useTheme()
 * // theme: 'system' | 'sunrise' | 'midnight' | ...
 * // setTheme('midnight') - changes theme and persists via Redux Storage Middleware
 */
export function useTheme() {
  const mounted = useMounted()
  // Gate DOM effects on localStorage hydration — without this, the initial
  // Redux state (`theme: 'system'`) would briefly overwrite the value the
  // <head> inline script applied for the user's saved theme, causing a FOUC.
  const hasHydrated = useStorageHydrated()

  const dispatch = useAppDispatch()
  const theme = useAppSelector(selectTheme)

  // Apply theme to document
  useEffect(() => {
    if (!mounted || !hasHydrated) return

    const root = document.documentElement

    let shouldBeDark: boolean
    if (theme === 'system') {
      // Only clear data-theme when switching INTO system — leaving it untouched
      // otherwise preserves the value set by the <head> inline anti-FOUC script.
      root.removeAttribute('data-theme')
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      root.setAttribute('data-theme', theme)
      shouldBeDark = isDarkTheme(theme)
    }
    root.classList.toggle('dark', shouldBeDark)
  }, [theme, mounted, hasHydrated])

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
    mounted,
  }
}

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

  const dispatch = useAppDispatch()
  const theme = useAppSelector(selectTheme)

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    root.removeAttribute('data-theme')

    let shouldBeDark: boolean
    if (theme === 'system') {
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    } else {
      root.setAttribute('data-theme', theme)
      shouldBeDark = isDarkTheme(theme)
    }
    root.classList.toggle('dark', shouldBeDark)
  }, [theme, mounted])

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

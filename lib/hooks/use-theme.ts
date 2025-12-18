/**
 * Theme Hook
 *
 * テーマ切り替え機能を提供するカスタムフック
 * LocalStorageに保存し、data-theme属性で適用
 */

'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// Helper to detect if we're in a browser environment
const getSnapshot = () => true
const getServerSnapshot = () => false
const subscribe = () => () => {}

export type ThemeType =
  // Light themes
  | 'sunrise'
  | 'sandstone'
  | 'mint'
  | 'sky'
  | 'lavender'
  | 'rose'
  // Dark themes
  | 'midnight'
  | 'graphite'
  | 'forest'
  | 'ocean'
  | 'plum'
  | 'rust'
  // Default (no custom theme)
  | 'system'

export const LIGHT_THEMES: ThemeType[] = [
  'sunrise',
  'sandstone',
  'mint',
  'sky',
  'lavender',
  'rose',
]

export const DARK_THEMES: ThemeType[] = [
  'midnight',
  'graphite',
  'forest',
  'ocean',
  'plum',
  'rust',
]

export const ALL_THEMES: ThemeType[] = [
  ...LIGHT_THEMES,
  ...DARK_THEMES,
  'system',
]

export function isDarkTheme(theme: ThemeType): boolean {
  return DARK_THEMES.includes(theme)
}

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

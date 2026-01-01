/**
 * Theme System
 *
 * Applies themes to DOM and manages CSS variables
 */

import type { Theme } from './supabase/types'

/**
 * Apply theme to DOM
 *
 * @param theme - Theme name to apply
 *
 * @example
 * ```ts
 * applyTheme('sunrise')  // Light theme
 * applyTheme('midnight') // Dark theme
 * ```
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return // Skip in SSR environment
  }

  const html = document.documentElement
  html.setAttribute('data-theme', theme)

  // Add dark class for dark themes
  if (isDarkTheme(theme)) {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

/**
 * Check if theme is dark mode
 *
 * @param theme - Theme name
 * @returns true if dark mode
 */
export function isDarkTheme(theme: Theme): boolean {
  const darkThemes: Theme[] = [
    'dark',
    'midnight',
    'graphite',
    'forest',
    'ocean',
    'plum',
    'rust',
  ]

  return darkThemes.includes(theme)
}

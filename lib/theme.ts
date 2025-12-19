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
 * Get currently applied theme
 *
 * @returns Current theme name, or null if not set
 */
export function getCurrentTheme(): Theme | null {
  if (typeof document === 'undefined') {
    return null
  }

  const html = document.documentElement
  const theme = html.getAttribute('data-theme')

  return theme as Theme | null
}

/**
 * Get CSS variable value
 *
 * @param variableName - CSS variable name (e.g., 'color-bg-primary')
 * @returns CSS variable value
 *
 * @example
 * ```ts
 * const bgColor = getCSSVariable('color-bg-primary')
 * // "#ffffff"
 * ```
 */
export function getCSSVariable(variableName: string): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const styles = getComputedStyle(document.documentElement)
  return styles.getPropertyValue(`--${variableName}`).trim()
}

/**
 * Check if theme is dark mode
 *
 * @param theme - Theme name
 * @returns true if dark mode
 */
export function isDarkTheme(theme: Theme): boolean {
  const darkThemes: Theme[] = [
    'midnight',
    'graphite',
    'forest',
    'ocean',
    'plum',
    'rust',
  ]

  return darkThemes.includes(theme)
}

/**
 * Get all theme names
 *
 * @returns Array of 12 theme names
 */
export function getAllThemes(): Theme[] {
  return [
    'sunrise',
    'sandstone',
    'mint',
    'sky',
    'lavender',
    'rose',
    'midnight',
    'graphite',
    'forest',
    'ocean',
    'plum',
    'rust',
  ]
}

/**
 * Classify themes into light and dark
 *
 * @returns Arrays of light and dark themes
 */
export function getThemesByMode(): {
  light: Theme[]
  dark: Theme[]
} {
  return {
    light: ['sunrise', 'sandstone', 'mint', 'sky', 'lavender', 'rose'],
    dark: ['midnight', 'graphite', 'forest', 'ocean', 'plum', 'rust'],
  }
}

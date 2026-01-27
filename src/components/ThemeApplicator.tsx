/**
 * Theme Applicator
 *
 * Client component that applies the current theme to the document.
 * Uses Redux state for theme value and applies via data-theme attribute and dark class.
 * Must be placed inside Redux Provider.
 */

'use client'

import { memo } from 'react'

import { useTheme } from '@/lib/hooks/use-theme'

/**
 * Renders nothing but applies theme to document via useTheme hook.
 * The useTheme hook's useEffect handles applying data-theme and dark class.
 */
export const ThemeApplicator = memo(function ThemeApplicator() {
  // Call useTheme to trigger theme application effects
  useTheme()

  // This component renders nothing - it just triggers the theme effects
  return null
})

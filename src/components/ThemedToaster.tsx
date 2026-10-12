/**
 * Themed Toaster
 *
 * The app's toasts, drawn in the light or the dark palette of the toast
 * library to match the theme the user chose.
 */

'use client'

import { memo } from 'react'
import { Toaster, type ToasterProps } from 'sonner'

import { type ThemeType, isDarkTheme } from '@/lib/constants/themes'
import { selectTheme } from '@/lib/redux/slices/settingsSlice'
import { useAppSelector } from '@/lib/redux/store'
import { areServerRenderedPropsEqual } from '@/lib/utils/are-server-rendered-props-equal'

/**
 * Renders every toast of the app. Exists because the toast library knows
 * light, dark and system only, and stayed light in the seven dark themes.
 * Rendered once by the root layout, inside {@link ReduxProvider}.
 *
 * @returns The toaster, bottom right, with rich colors.
 * @example
 * <ReduxProvider>
 *   {children}
 *   <ThemedToaster />
 * </ReduxProvider>
 */
export const ThemedToaster = memo(function ThemedToaster() {
  const theme = useAppSelector(selectTheme)

  return (
    <Toaster richColors position="bottom-right" theme={toToastScheme(theme)} />
  )
}, areServerRenderedPropsEqual)

/**
 * Maps one of the app's themes to the palette the toast library draws in.
 *
 * @param theme - The theme chosen in the sidebar.
 * @returns
 * - `'system'` for the System theme: the library follows the device, as the page does
 * - `'dark'` for a dark theme (dark, midnight, graphite, forest, ocean, plum, rust)
 * - `'light'` for a light theme
 * @example
 * toToastScheme('midnight') // => 'dark'
 * toToastScheme('rose')     // => 'light'
 * toToastScheme('system')   // => 'system'
 */
function toToastScheme(theme: ThemeType): NonNullable<ToasterProps['theme']> {
  if (theme === 'system') return 'system'
  return isDarkTheme(theme) ? 'dark' : 'light'
}

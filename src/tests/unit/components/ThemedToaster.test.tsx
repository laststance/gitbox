/**
 * Unit Test: ThemedToaster
 *
 * Regression test for the design review of issue #213 (FINDING-004): toasts
 * kept the light palette of the toast library in the seven dark themes.
 */

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, test, vi } from 'vitest'

import { ThemedToaster } from '@/components/ThemedToaster'
import type { ThemeType } from '@/lib/constants/themes'
import settingsReducer from '@/lib/redux/slices/settingsSlice'

// The toast library draws nothing until a toast exists: show what it was told
vi.mock('sonner', () => ({
  Toaster: ({ theme }: { theme?: string }) => (
    <div data-testid="toaster" data-toast-scheme={theme} />
  ),
}))

/**
 * Renders the toaster for a user who chose the given theme.
 * @param theme - The theme stored in the settings.
 */
function renderToasterWithTheme(theme: ThemeType): void {
  const store = configureStore({
    reducer: { settings: settingsReducer },
    preloadedState: {
      settings: {
        theme,
        typography: { baseSize: 16, scale: 1.25 },
        compactMode: false,
        showCardMetadata: true,
        organizationFilter: 'all',
        sidebarCollapsed: false,
      },
    },
  })
  render(
    <Provider store={store}>
      <ThemedToaster />
    </Provider>,
  )
}

describe('ThemedToaster', () => {
  test('draws toasts in the dark palette when the theme is Midnight', () => {
    // Arrange & Act
    renderToasterWithTheme('midnight')

    // Assert
    expect(screen.getByTestId('toaster')).toHaveAttribute(
      'data-toast-scheme',
      'dark',
    )
  })

  test('draws toasts in the light palette when the theme is Rose', () => {
    // Arrange & Act
    renderToasterWithTheme('rose')

    // Assert
    expect(screen.getByTestId('toaster')).toHaveAttribute(
      'data-toast-scheme',
      'light',
    )
  })

  test('lets toasts follow the device when the theme is System', () => {
    // Arrange & Act
    renderToasterWithTheme('system')

    // Assert
    expect(screen.getByTestId('toaster')).toHaveAttribute(
      'data-toast-scheme',
      'system',
    )
  })
})

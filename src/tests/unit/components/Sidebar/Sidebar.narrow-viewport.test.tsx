/**
 * Unit Test: Sidebar on a narrow viewport
 *
 * Regression test for the design review of issue #213 (FINDING-001): at
 * 375px the open sidebar kept its 256px and left the page 119px, and open is
 * what a new account starts with.
 */

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { Sidebar } from '@/components/Sidebar/Sidebar'
import settingsReducer from '@/lib/redux/slices/settingsSlice'

vi.mock('next/navigation', () => ({
  usePathname: () => '/boards',
}))

vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  openShortcutsHelp: vi.fn(),
}))

/**
 * Makes `window.matchMedia` answer as a viewport of the given width would for
 * a `(max-width: …px)` query, which is the only kind the sidebar asks.
 * @param viewportWidthPx - Width of the pretended viewport.
 */
function stubViewportWidth(viewportWidthPx: number): void {
  vi.stubGlobal('matchMedia', (mediaQuery: string) => {
    const maxWidthPx = Number(/max-width:\s*([\d.]+)px/.exec(mediaQuery)?.[1])
    return {
      matches: viewportWidthPx <= maxWidthPx,
      media: mediaQuery,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
  })
}

/**
 * Renders the sidebar for a user who left it open (the default).
 */
function renderOpenSidebar(): void {
  const store = configureStore({
    reducer: { settings: settingsReducer },
    preloadedState: {
      settings: {
        theme: 'system' as const,
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
      <Sidebar userName="octocat" />
    </Provider>,
  )
}

describe('Sidebar on a narrow viewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('is the 64px icon rail on a 375px phone although the user left it open', () => {
    // Arrange
    stubViewportWidth(375)

    // Act
    renderOpenSidebar()

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByText('GitBox')).toBeNull()
  })

  test('offers no "Expand sidebar" on a phone, where the open sidebar does not fit', () => {
    // Arrange
    stubViewportWidth(375)

    // Act
    renderOpenSidebar()

    // Assert
    expect(screen.queryByRole('button', { name: 'Expand sidebar' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Collapse sidebar' }),
    ).toBeNull()
  })

  test('names every icon of the rail for a screen reader', () => {
    // Arrange
    stubViewportWidth(375)

    // Act
    renderOpenSidebar()

    // Assert
    expect(screen.getByRole('link', { name: 'All Boards' })).toHaveAttribute(
      'href',
      '/boards',
    )
    expect(screen.getByRole('link', { name: 'Favorites' })).toHaveAttribute(
      'href',
      '/boards/favorites',
    )
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    )
    expect(screen.getByRole('button', { name: 'Shortcuts' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'octocat' })).toHaveAttribute(
      'href',
      '/account',
    )
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeVisible()
  })

  test('stays open with its labels and the collapse button on a 1024px viewport', () => {
    // Arrange
    stubViewportWidth(1024)

    // Act
    renderOpenSidebar()

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-64')
    expect(screen.getByText('All Boards')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toBeVisible()
  })

  test('keeps the rail width for a phone in the markup the server sends', () => {
    // Arrange
    stubViewportWidth(1024)

    // Act
    renderOpenSidebar()

    // Assert: the class draws the rail before the client has run
    expect(screen.getByRole('complementary')).toHaveClass('max-md:w-16')
  })
})

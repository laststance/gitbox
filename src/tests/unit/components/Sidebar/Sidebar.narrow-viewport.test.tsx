/**
 * Unit Test: Sidebar on a narrow viewport
 *
 * Regression test for the design review of issue #213 (FINDING-001): at
 * 375px the open sidebar kept its 256px and left the page 119px, and open is
 * what a new account starts with.
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen } from '@testing-library/react'
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
 * Like {@link stubViewportWidth}, but the viewport can be resized after the
 * page is rendered: the pretended window tells every `change` listener of a
 * query that is registered, as the browser does when a window is resized or a
 * tablet is turned.
 * @param initialWidthPx - Width of the pretended viewport when the page opens.
 * @returns `resizeTo`, which sets a new width and notifies the listeners.
 */
function stubResizableViewport(initialWidthPx: number): {
  resizeTo: (widthPx: number) => void
} {
  let viewportWidthPx = initialWidthPx
  const changeListeners = new Set<() => void>()

  vi.stubGlobal('matchMedia', (mediaQuery: string) => {
    const maxWidthPx = Number(/max-width:\s*([\d.]+)px/.exec(mediaQuery)?.[1])
    return {
      get matches() {
        return viewportWidthPx <= maxWidthPx
      },
      media: mediaQuery,
      addEventListener: (_eventType: string, listener: () => void): void => {
        changeListeners.add(listener)
      },
      removeEventListener: (_eventType: string, listener: () => void): void => {
        changeListeners.delete(listener)
      },
    }
  })

  return {
    resizeTo: (widthPx: number): void => {
      viewportWidthPx = widthPx
      changeListeners.forEach((listener) => listener())
    },
  }
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

  // Value: protects=a sidebar the user left open becomes the icon rail when the window shrinks to a phone width and is open again, as left, when it grows back; fails_when=the viewport subscription is dropped or the open choice is overwritten; why_new=the other tests here stub matchMedia with listeners that never fire; seam=none; no_claim=real browser resize and the CSS breakpoint (matchMedia stubbed)
  test('turns into the icon rail when the window shrinks to a phone width and is open again, as the user left it, when the window grows back', () => {
    // Arrange: a 1024px window, the sidebar left open
    const viewport = stubResizableViewport(1024)
    renderOpenSidebar()
    expect(screen.getByRole('complementary')).toHaveClass('w-64')

    // Act: the window shrinks to a phone width
    act(() => viewport.resizeTo(375))

    // Assert: the rail, without waiting for a reload
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByText('GitBox')).toBeNull()

    // Act: the window grows back
    act(() => viewport.resizeTo(1024))

    // Assert: open again, because that is what the user chose
    expect(screen.getByRole('complementary')).toHaveClass('w-64')
    expect(screen.getByText('All Boards')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toBeVisible()
  })
})

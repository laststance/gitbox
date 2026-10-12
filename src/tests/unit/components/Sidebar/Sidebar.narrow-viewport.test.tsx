/**
 * Unit Test: Sidebar on a narrow viewport
 *
 * Regression test for the design review of issue #213 (FINDING-001): at
 * 375px the open sidebar kept its 256px and left the page 119px, and open is
 * what a new account starts with. Below 768px the sidebar is the icon rail,
 * and its toggle opens it over the page: a touch screen shows no tooltip, so
 * that is the only way to read what the icons mean.
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes } from 'react'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { Sidebar } from '@/components/Sidebar/Sidebar'
import { NARROW_VIEWPORT_MEDIA_QUERY } from '@/lib/constants/breakpoints'
import { openShortcutsHelp } from '@/lib/events'
import settingsReducer from '@/lib/redux/slices/settingsSlice'

vi.mock('next/navigation', () => ({
  usePathname: () => '/boards',
}))

// A plain anchor: the test page has no router and nowhere to go
vi.mock('next/link', () => ({
  default: ({
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
    >
      {children}
    </a>
  ),
}))

vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn(),
}))

vi.mock('@/lib/events', () => ({
  openShortcutsHelp: vi.fn(),
}))

/** Root font size the pretended browser has: 1rem is 16px. */
const ROOT_FONT_SIZE_PX = 16

/**
 * Answers a `not all and (min-width: …rem)` query, which is the only kind the
 * sidebar asks, as a viewport of the given width would.
 * @param mediaQuery - The query handed to `window.matchMedia`.
 * @param viewportWidthPx - Width of the pretended viewport.
 * @returns Whether the query matches. `false` for any other kind of query,
 * so a test of the rail fails when the sidebar starts to ask differently.
 * @example
 * matchesViewport('not all and (min-width: 48rem)', 375)  // => true
 * matchesViewport('not all and (min-width: 48rem)', 1024) // => false
 */
function matchesViewport(mediaQuery: string, viewportWidthPx: number): boolean {
  const minWidthRem = Number(
    /^not all and \(min-width:\s*([\d.]+)rem\)$/.exec(mediaQuery)?.[1],
  )
  return viewportWidthPx < minWidthRem * ROOT_FONT_SIZE_PX
}

/**
 * Makes `window.matchMedia` answer as a viewport of the given width would.
 * @param viewportWidthPx - Width of the pretended viewport.
 */
function stubViewportWidth(viewportWidthPx: number): void {
  vi.stubGlobal('matchMedia', (mediaQuery: string) => ({
    matches: matchesViewport(mediaQuery, viewportWidthPx),
    media: mediaQuery,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
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

  vi.stubGlobal('matchMedia', (mediaQuery: string) => ({
    get matches() {
      return matchesViewport(mediaQuery, viewportWidthPx)
    },
    media: mediaQuery,
    addEventListener: (_eventType: string, listener: () => void): void => {
      changeListeners.add(listener)
    },
    removeEventListener: (_eventType: string, listener: () => void): void => {
      changeListeners.delete(listener)
    },
  }))

  return {
    resizeTo: (widthPx: number): void => {
      viewportWidthPx = widthPx
      changeListeners.forEach((listener) => listener())
    },
  }
}

/**
 * Renders the sidebar for a user who left it open (the default), beside a
 * page with one button, the way a layout puts the two into one row.
 * @returns The store, so a test can read what is kept for the next visit.
 */
function renderOpenSidebar() {
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
      <div>
        <Sidebar userName="octocat" />
        <main>
          <button type="button">Create Board</button>
        </main>
      </div>
    </Provider>,
  )
  return { store }
}

describe('Sidebar on a narrow viewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  test('asks the browser in rem, the unit of the max-md classes that draw the rail before the page has hydrated', () => {
    // Arrange & Act & Assert: with a px query the two disagree for a reader
    // whose browser font size is not 16px, and the labels are cut off at 64px
    expect(NARROW_VIEWPORT_MEDIA_QUERY).toBe('not all and (min-width: 48rem)')
  })

  test('is the 64px icon rail on a 375px phone although the user left it open', () => {
    // Arrange
    stubViewportWidth(375)

    // Act
    renderOpenSidebar()

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByText('GitBox')).toBeNull()
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull()
  })

  test('opens over the page with its labels when "Expand sidebar" is pressed on a phone, and keeps what the user chose for a wide window', async () => {
    // Arrange
    const user = userEvent.setup()
    stubViewportWidth(375)
    const { store } = renderOpenSidebar()

    // Act
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    // Assert: 256px with every label, lying over the page
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('w-64')
    expect(sidebar).toHaveClass('max-md:fixed')
    expect(sidebar).not.toHaveClass('max-md:w-16')
    expect(screen.getByText('GitBox')).toBeVisible()
    expect(screen.getByText('All Boards')).toBeVisible()
    expect(screen.getByText('Settings')).toBeVisible()
    expect(screen.getByText('Sign Out')).toBeVisible()
    expect(screen.getByTestId('sidebar-backdrop')).toBeVisible()
    // Assert: opening it on a phone is not the choice that is stored
    expect(store.getState().settings.sidebarCollapsed).toBe(false)
  })

  test('is the rail again when the page behind the opened sidebar is pressed', async () => {
    // Arrange
    const user = userEvent.setup()
    stubViewportWidth(375)
    renderOpenSidebar()
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    // Act
    await user.click(screen.getByTestId('sidebar-backdrop'))

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByText('GitBox')).toBeNull()
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull()
  })

  test('is the rail again when a link of the opened sidebar is chosen, so the page it leads to is not covered', async () => {
    // Arrange
    const user = userEvent.setup()
    stubViewportWidth(375)
    renderOpenSidebar()
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    // Act
    await user.click(screen.getByRole('link', { name: 'Favorites' }))

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull()
  })

  test('is the rail again when Shortcuts is chosen, so the help it opens is not covered', async () => {
    // Arrange
    const user = userEvent.setup()
    stubViewportWidth(375)
    renderOpenSidebar()
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    // Act
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }))

    // Assert
    expect(openShortcutsHelp).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull()
  })

  test('closes on Escape and hands the keyboard back to the button that opened it', async () => {
    // Arrange
    const user = userEvent.setup()
    stubViewportWidth(375)
    renderOpenSidebar()
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(
      screen.getByRole('button', { name: 'Collapse sidebar' }),
    ).toHaveFocus()

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveFocus()
  })

  test('keeps the keyboard and a screen reader out of the page while the sidebar lies over it, and lets them back in when it closes', async () => {
    // Arrange
    const user = userEvent.setup()
    stubViewportWidth(375)
    renderOpenSidebar()
    const page = screen.getByRole('main')
    expect(page).not.toHaveAttribute('inert')

    // Act
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    // Assert: the page is under the backdrop, so it is out of reach
    expect(page).toHaveAttribute('inert')

    // Act
    await user.click(screen.getByTestId('sidebar-backdrop'))

    // Assert
    expect(page).not.toHaveAttribute('inert')
  })

  test('leaves the page within reach while the sidebar is the rail beside it', () => {
    // Arrange
    stubViewportWidth(375)

    // Act
    renderOpenSidebar()

    // Assert
    expect(screen.getByRole('main')).not.toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Create Board' })).toBeVisible()
  })

  test('closes on Escape when the focus is on nothing, as after a tap on the background of the sidebar', async () => {
    // Arrange
    const user = userEvent.setup()
    stubViewportWidth(375)
    renderOpenSidebar()
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    screen.getByRole('button', { name: 'Collapse sidebar' }).blur()
    expect(document.body).toHaveFocus()

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveFocus()
  })

  test('stays open when Escape is pressed in a menu that is drawn outside of the sidebar: that key closes the menu', async () => {
    // Arrange: the theme list is drawn at the end of the document, not in
    // the sidebar; a menu with one item stands in for it
    const user = userEvent.setup()
    stubViewportWidth(375)
    renderOpenSidebar()
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    const menuItem = document.createElement('button')
    menuItem.textContent = 'Midnight'
    menu.append(menuItem)
    document.body.append(menu)
    menuItem.focus()

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-64')
    expect(screen.getByTestId('sidebar-backdrop')).toBeVisible()

    menu.remove()
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
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull()
  })

  test('keeps the rail for a phone in the markup the server sends: its width, and the 64px its place keeps free for it', () => {
    // Arrange
    stubViewportWidth(1024)

    // Act
    renderOpenSidebar()

    // Assert: the classes draw the rail before the client has run
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('max-md:w-16')
    expect(sidebar).toHaveClass('max-md:fixed')
    expect(screen.getByTestId('sidebar-place')).toHaveClass(
      'max-md:w-16',
      'max-md:shrink-0',
      'md:contents',
    )
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

  test('starts as the rail when a window comes back to a phone width, although the sidebar was opened over the page before', async () => {
    // Arrange: opened over the page on a phone-sized window
    const user = userEvent.setup()
    const viewport = stubResizableViewport(375)
    renderOpenSidebar()
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByTestId('sidebar-backdrop')).toBeVisible()

    // Act: the window grows wide and shrinks again
    act(() => viewport.resizeTo(1024))
    act(() => viewport.resizeTo(375))

    // Assert
    expect(screen.getByRole('complementary')).toHaveClass('w-16')
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull()
  })
})

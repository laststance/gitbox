/**
 * Unit Test: Sidebar Component
 *
 * Test targets:
 * - Expanded/collapsed state rendering
 * - Toggle button functionality
 * - Tooltip display in collapsed mode
 * - Navigation items rendering
 * - User profile section
 * - Accessibility (ARIA labels)
 */

import { configureStore } from '@reduxjs/toolkit'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { Sidebar } from '@/components/Sidebar/Sidebar'
import settingsReducer from '@/lib/redux/slices/settingsSlice'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/boards',
}))

// Mock server actions
vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn(),
}))

// Mock lib/events
vi.mock('@/lib/events', () => ({
  openShortcutsHelp: vi.fn(),
}))

/**
 * Creates a test store with initial sidebar collapsed state
 * @param isCollapsed - Initial collapsed state
 */
function createTestStore(isCollapsed = false) {
  return configureStore({
    reducer: {
      settings: settingsReducer,
    },
    preloadedState: {
      settings: {
        theme: 'system' as const,
        typography: { baseSize: 16, scale: 1.25 },
        compactMode: false,
        showCardMetadata: true,
        organizationFilter: 'all',
        sidebarCollapsed: isCollapsed,
      },
    },
  })
}

/**
 * Renders Sidebar with Redux provider
 */
function renderSidebar(
  props?: Partial<Parameters<typeof Sidebar>[0]>,
  isCollapsed = false,
) {
  const store = createTestStore(isCollapsed)
  return {
    ...render(
      <Provider store={store}>
        <Sidebar userName="octocat" {...props} />
      </Provider>,
    ),
    store,
  }
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Expanded State', () => {
    it('should render with w-64 width class when expanded', () => {
      renderSidebar()

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-64')
    })

    it('should display GitBox logo text when expanded', () => {
      renderSidebar()

      expect(screen.getByText('GitBox')).toBeInTheDocument()
    })

    it('should display full navigation labels when expanded', () => {
      renderSidebar()

      expect(screen.getByText('All Boards')).toBeInTheDocument()
      expect(screen.getByText('Favorites')).toBeInTheDocument()
      expect(screen.getByText('Maintenance Mode')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Shortcuts')).toBeInTheDocument()
    })

    it('should display user name when expanded', () => {
      renderSidebar({ userName: 'testuser' })

      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('should display "Sign out" button text when expanded', () => {
      renderSidebar()

      expect(screen.getByText('Sign out')).toBeInTheDocument()
    })

    it('should display collapsible Boards section header when expanded', () => {
      renderSidebar()

      expect(screen.getByText('Boards')).toBeInTheDocument()
    })
  })

  describe('Collapsed State', () => {
    it('should render with w-16 width class when collapsed', () => {
      renderSidebar({}, true)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-16')
    })

    it('should NOT display GitBox logo text when collapsed', () => {
      renderSidebar({}, true)

      expect(screen.queryByText('GitBox')).not.toBeInTheDocument()
    })

    it('should NOT display navigation labels when collapsed', () => {
      renderSidebar({}, true)

      // These should be in tooltips only, not visible text
      expect(screen.queryByText('All Boards')).not.toBeInTheDocument()
      expect(screen.queryByText('Favorites')).not.toBeInTheDocument()
    })

    it('should NOT display Boards section header when collapsed', () => {
      renderSidebar({}, true)

      expect(screen.queryByText('Boards')).not.toBeInTheDocument()
    })

    it('should NOT display user name text when collapsed', () => {
      renderSidebar({ userName: 'testuser' }, true)

      // User name should only be in tooltip
      expect(screen.queryByText('testuser')).not.toBeInTheDocument()
    })

    it('should NOT display "Sign out" text when collapsed', () => {
      renderSidebar({}, true)

      expect(screen.queryByText('Sign out')).not.toBeInTheDocument()
    })
  })

  describe('Toggle Button', () => {
    it('should display toggle button', () => {
      renderSidebar()

      const toggleButton = screen.getByRole('button', {
        name: /collapse sidebar/i,
      })
      expect(toggleButton).toBeInTheDocument()
    })

    it('should have "Expand sidebar" label when collapsed', () => {
      renderSidebar({}, true)

      const toggleButton = screen.getByRole('button', {
        name: /expand sidebar/i,
      })
      expect(toggleButton).toBeInTheDocument()
    })

    it('should dispatch toggle action when clicked', () => {
      const { store } = renderSidebar()

      const toggleButton = screen.getByRole('button', {
        name: /collapse sidebar/i,
      })
      fireEvent.click(toggleButton)

      expect(store.getState().settings.sidebarCollapsed).toBe(true)
    })

    it('should toggle from collapsed to expanded', () => {
      const { store } = renderSidebar({}, true)

      const toggleButton = screen.getByRole('button', {
        name: /expand sidebar/i,
      })
      fireEvent.click(toggleButton)

      expect(store.getState().settings.sidebarCollapsed).toBe(false)
    })
  })

  describe('Navigation Links', () => {
    it('should render All Boards link', () => {
      renderSidebar()

      const link = screen.getByRole('link', { name: /all boards/i })
      expect(link).toHaveAttribute('href', '/boards')
    })

    it('should render Favorites link', () => {
      renderSidebar()

      const link = screen.getByRole('link', { name: /favorites/i })
      expect(link).toHaveAttribute('href', '/boards/favorites')
    })

    it('should render Maintenance Mode link', () => {
      renderSidebar()

      const link = screen.getByRole('link', { name: /maintenance mode/i })
      expect(link).toHaveAttribute('href', '/maintenance')
    })

    it('should render Settings link', () => {
      renderSidebar()

      const link = screen.getByRole('link', { name: /settings/i })
      expect(link).toHaveAttribute('href', '/settings')
    })

    it('should highlight active link', () => {
      renderSidebar()

      // /boards is mocked as current path
      const allBoardsLink = screen.getByRole('link', { name: /all boards/i })
      expect(allBoardsLink).toHaveClass('bg-primary/10')
    })
  })

  describe('Shortcuts Button', () => {
    it('should render Shortcuts button', () => {
      renderSidebar()

      const button = screen.getByRole('button', { name: /shortcuts/i })
      expect(button).toBeInTheDocument()
    })

    it('should call openShortcutsHelp when clicked', async () => {
      const { openShortcutsHelp } = await import('@/lib/events')
      renderSidebar()

      const button = screen.getByRole('button', { name: /shortcuts/i })
      fireEvent.click(button)

      expect(openShortcutsHelp).toHaveBeenCalled()
    })
  })

  describe('User Profile Section', () => {
    it('should render user avatar when provided', () => {
      renderSidebar({
        userName: 'octocat',
        userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
      })

      const avatar = screen.getByRole('img', { name: 'octocat' })
      expect(avatar).toBeInTheDocument()
    })

    it('should render fallback icon when no avatar provided', () => {
      renderSidebar({ userName: 'testuser' })

      // Fallback div with User icon should be present
      const profileLink = screen.getByRole('link', { name: /testuser/i })
      expect(profileLink).toBeInTheDocument()
    })

    it('should render account link', () => {
      renderSidebar()

      const accountLink = screen.getByRole('link', { name: /octocat/i })
      expect(accountLink).toHaveAttribute('href', '/account')
    })

    it('should render sign out button', () => {
      renderSidebar()

      // In expanded mode, there's a button with "Sign out" text
      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      expect(signOutButton).toBeInTheDocument()
    })

    it('should call signOut when sign out button is clicked', async () => {
      const { signOut } = await import('@/lib/actions/auth')
      renderSidebar()

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      fireEvent.click(signOutButton)

      expect(signOut).toHaveBeenCalled()
    })
  })

  describe('ThemeToggle Integration', () => {
    it('should render ThemeToggle component', () => {
      renderSidebar()

      // Theme toggle shows "Theme" text when expanded
      expect(screen.getByText('Theme')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have complementary role for aside element', () => {
      renderSidebar()

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toBeInTheDocument()
    })

    it('should have navigation element', () => {
      renderSidebar()

      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
    })

    it('should have proper aria-label on toggle button', () => {
      renderSidebar()

      const toggleButton = screen.getByRole('button', {
        name: /collapse sidebar/i,
      })
      expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar')
    })

    it('should have proper aria-label on sign out button', () => {
      renderSidebar({}, true)

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      expect(signOutButton).toHaveAttribute('aria-label', 'Sign out')
    })
  })

  describe('CSS Transition', () => {
    it('should have transition classes for width animation', () => {
      renderSidebar()

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('transition-[width]')
      expect(sidebar).toHaveClass('duration-300')
      expect(sidebar).toHaveClass('ease-out')
    })
  })

  describe('Boards Section Toggle', () => {
    it('should toggle Boards section when header is clicked', () => {
      renderSidebar()

      // Initially both nav items should be visible
      expect(screen.getByRole('link', { name: /all boards/i })).toBeVisible()
      expect(screen.getByRole('link', { name: /favorites/i })).toBeVisible()

      // Click the Boards header to collapse
      const boardsHeader = screen.getByRole('button', { name: /boards/i })
      fireEvent.click(boardsHeader)

      // Nav items should be hidden (not in document after collapse)
      // They're conditionally rendered based on boardsExpanded state
      // After clicking, boardsExpanded = false, so the links won't render
      expect(
        screen.queryByRole('link', { name: /all boards/i }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /favorites/i }),
      ).not.toBeInTheDocument()
    })
  })
})

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
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, test, expect, vi, beforeEach } from 'vitest'

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
    test('should render with w-64 width class when expanded', () => {
      renderSidebar()

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-64')
    })

    test('should display GitBox logo text when expanded', () => {
      renderSidebar()

      expect(screen.getByText('GitBox')).toBeInTheDocument()
    })

    test('should display full navigation labels when expanded', () => {
      renderSidebar()

      expect(screen.getByText('All Boards')).toBeInTheDocument()
      expect(screen.getByText('Favorites')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Shortcuts')).toBeInTheDocument()
    })

    test('should display user name when expanded', () => {
      renderSidebar({ userName: 'testuser' })

      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    test('should display "Sign Out" button text when expanded', () => {
      renderSidebar()

      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })

    test('should display collapsible Boards section header when expanded', () => {
      renderSidebar()

      expect(screen.getByText('Boards')).toBeInTheDocument()
    })
  })

  describe('Collapsed State', () => {
    test('should render with w-16 width class when collapsed', () => {
      renderSidebar({}, true)

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('w-16')
    })

    test('should NOT display GitBox logo text when collapsed', () => {
      renderSidebar({}, true)

      expect(screen.queryByText('GitBox')).not.toBeInTheDocument()
    })

    test('should NOT display navigation labels when collapsed', () => {
      renderSidebar({}, true)

      // These should be in tooltips only, not visible text
      expect(screen.queryByText('All Boards')).not.toBeInTheDocument()
      expect(screen.queryByText('Favorites')).not.toBeInTheDocument()
    })

    test('should NOT display Boards section header when collapsed', () => {
      renderSidebar({}, true)

      expect(screen.queryByText('Boards')).not.toBeInTheDocument()
    })

    test('should NOT display user name text when collapsed', () => {
      renderSidebar({ userName: 'testuser' }, true)

      // User name should only be in tooltip
      expect(screen.queryByText('testuser')).not.toBeInTheDocument()
    })

    test('should NOT display "Sign Out" text when collapsed', () => {
      renderSidebar({}, true)

      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
    })
  })

  describe('Toggle Button', () => {
    test('should display toggle button', () => {
      renderSidebar()

      const toggleButton = screen.getByRole('button', {
        name: /collapse sidebar/i,
      })
      expect(toggleButton).toBeInTheDocument()
    })

    test('should have "Expand sidebar" label when collapsed', () => {
      renderSidebar({}, true)

      const toggleButton = screen.getByRole('button', {
        name: /expand sidebar/i,
      })
      expect(toggleButton).toBeInTheDocument()
    })

    test('should dispatch toggle action when clicked', () => {
      const { store } = renderSidebar()

      const toggleButton = screen.getByRole('button', {
        name: /collapse sidebar/i,
      })
      fireEvent.click(toggleButton)

      expect(store.getState().settings.sidebarCollapsed).toBe(true)
    })

    test('should toggle from collapsed to expanded', () => {
      const { store } = renderSidebar({}, true)

      const toggleButton = screen.getByRole('button', {
        name: /expand sidebar/i,
      })
      fireEvent.click(toggleButton)

      expect(store.getState().settings.sidebarCollapsed).toBe(false)
    })

    test('keeps the keyboard focus on the toggle when the sidebar is collapsed and when it is expanded again', async () => {
      // Arrange: a keyboard user stands on the toggle
      const user = userEvent.setup()
      renderSidebar()
      const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
      toggle.focus()

      // Act
      await user.keyboard('{Enter}')

      // Assert: the rail shows the same button, not a second one that would
      // have taken its place and left the focus on nothing
      const railToggle = screen.getByRole('button', { name: 'Expand sidebar' })
      expect(railToggle).toBe(toggle)
      expect(railToggle).toHaveFocus()

      // Act
      await user.keyboard('{Enter}')

      // Assert
      expect(
        screen.getByRole('button', { name: 'Collapse sidebar' }),
      ).toHaveFocus()
    })
  })

  describe('Navigation Links', () => {
    test('should render All Boards link', () => {
      renderSidebar()

      const link = screen.getByRole('link', { name: /all boards/i })
      expect(link).toHaveAttribute('href', '/boards')
    })

    test('should render Favorites link', () => {
      renderSidebar()

      const link = screen.getByRole('link', { name: /favorites/i })
      expect(link).toHaveAttribute('href', '/boards/favorites')
    })

    test('should render Settings link', () => {
      renderSidebar()

      const link = screen.getByRole('link', { name: /settings/i })
      expect(link).toHaveAttribute('href', '/settings')
    })

    // Value: protects=the label of the page the user is on is readable in every theme; fails_when=the label is drawn in the theme color again, which on its own 10% tint is below 4.5:1 in 11 of the 14 themes; why_new=the test before read the tint alone, not the color of the label on it; seam=none; no_claim=the contrast itself (computed for every theme in sidebar-label-contrast.test.ts)
    test('marks the page the user is on with a tint of the theme color under a label in the color of the sidebar text', () => {
      // Arrange & Act: /boards is mocked as the current path
      renderSidebar()

      // Assert
      const allBoardsLink = screen.getByRole('link', { name: 'All Boards' })
      expect(allBoardsLink).toHaveClass(
        'bg-primary/10',
        'text-sidebar-foreground',
      )
      expect(allBoardsLink).not.toHaveClass('text-primary')
      expect(screen.getByRole('link', { name: 'Favorites' })).toHaveClass(
        'text-muted-foreground',
      )
    })

    // Value: protects=a screen reader is told which page is open, in the open sidebar and in the icon rail; fails_when=aria-current leaves the active link or lands on another link; why_new=the one active-link test reads a CSS class, which a screen reader does not; seam=none; no_claim=how a screen reader announces it (DOM attribute only)
    test.each([
      { state: 'open', isCollapsed: false },
      { state: 'collapsed to the icon rail', isCollapsed: true },
    ])(
      'tells a screen reader which page is open when the sidebar is $state: the current link says so and no other link does',
      ({ isCollapsed }) => {
        // Arrange / Act: /boards is mocked as the current path
        renderSidebar({}, isCollapsed)

        // Assert
        expect(
          screen.getByRole('link', { name: 'All Boards' }),
        ).toHaveAttribute('aria-current', 'page')
        expect(
          screen.getByRole('link', { name: 'Favorites' }),
        ).not.toHaveAttribute('aria-current')
        expect(
          screen.getByRole('link', { name: 'Settings' }),
        ).not.toHaveAttribute('aria-current')
      },
    )
  })

  describe('Navigation Dividers', () => {
    test('shows exactly one divider between the board links and Settings when expanded', () => {
      // Arrange
      renderSidebar()

      // Act
      const navigation = screen.getByRole('navigation')
      const dividers = Array.from(navigation.children).filter((child) =>
        child.classList.contains('border-t'),
      )

      // Assert
      expect(dividers).toHaveLength(1)
      expect(dividers[0]?.previousElementSibling).toHaveTextContent(
        'All BoardsFavorites',
      )
      expect(dividers[0]?.nextElementSibling).toHaveAttribute(
        'href',
        '/settings',
      )
    })

    test('shows exactly one divider between the board links and Settings when collapsed', () => {
      // Arrange
      renderSidebar({}, true)

      // Act
      const navigation = screen.getByRole('navigation')
      const dividers = Array.from(navigation.children).filter((child) =>
        child.classList.contains('border-t'),
      )

      // Assert
      expect(dividers).toHaveLength(1)
      expect(
        dividers[0]?.previousElementSibling?.querySelector(
          'a[href="/boards/favorites"]',
        ),
      ).not.toBeNull()
      expect(dividers[0]?.nextElementSibling).toHaveAttribute(
        'href',
        '/settings',
      )
    })
  })

  describe('Shortcuts Button', () => {
    test('should render Shortcuts button', () => {
      renderSidebar()

      const button = screen.getByRole('button', { name: /shortcuts/i })
      expect(button).toBeInTheDocument()
    })

    test('should call openShortcutsHelp when clicked', async () => {
      const { openShortcutsHelp } = await import('@/lib/events')
      renderSidebar()

      const button = screen.getByRole('button', { name: /shortcuts/i })
      fireEvent.click(button)

      expect(openShortcutsHelp).toHaveBeenCalled()
    })
  })

  describe('User Profile Section', () => {
    test('should render user avatar when provided', () => {
      renderSidebar({
        userName: 'octocat',
        userAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
      })

      const avatar = screen.getByRole('img', { name: 'octocat' })
      expect(avatar).toBeInTheDocument()
    })

    test('should render fallback icon when no avatar provided', () => {
      renderSidebar({ userName: 'testuser' })

      // Fallback div with User icon should be present
      const profileLink = screen.getByRole('link', { name: /testuser/i })
      expect(profileLink).toBeInTheDocument()
    })

    test('should render account link', () => {
      renderSidebar()

      const accountLink = screen.getByRole('link', { name: /octocat/i })
      expect(accountLink).toHaveAttribute('href', '/account')
    })

    test('should render sign out button', () => {
      renderSidebar()

      // In expanded mode, there's a button with "Sign Out" text
      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      expect(signOutButton).toBeInTheDocument()
    })

    test('should call signOut when sign out button is clicked', async () => {
      const { signOut } = await import('@/lib/actions/auth')
      renderSidebar()

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      fireEvent.click(signOutButton)

      expect(signOut).toHaveBeenCalled()
    })
  })

  describe('ThemeToggle Integration', () => {
    test('should render ThemeToggle component', () => {
      renderSidebar()

      // Theme toggle shows "Theme" text when expanded
      expect(screen.getByText('Theme')).toBeInTheDocument()
    })

    // Value: protects=the name of the current theme beside "Theme" is readable on the sidebar, at rest and under the pointer; fails_when=the 12px name is dimmed again (at 70% it was between 2.6:1 and 4.0:1 in every theme), or gets a color of its own, which stays muted on the button's hover fill (1.9:1 to 2.4:1 in six dark themes); why_new=no test named the color of that label; seam=none; no_claim=the contrast itself (computed for every theme in sidebar-label-contrast.test.ts)
    test('shows the name of the current theme in the color of its button, muted at rest, and not dimmed further', () => {
      // Arrange & Act: the store starts with the system theme
      renderSidebar()

      // Assert: the button is muted and takes the foreground color under the
      // pointer; the name follows it, with no color and no opacity of its own
      const currentThemeName = screen.getByText('System')
      const themeButton = screen.getByRole('button', { name: /Theme/ })
      expect(themeButton).toContainElement(currentThemeName)
      expect(themeButton).toHaveClass(
        'text-muted-foreground',
        'hover:text-foreground',
      )
      expect(currentThemeName).toHaveAttribute('class', 'text-xs')
    })
  })

  describe('Accessibility', () => {
    test('should have complementary role for aside element', () => {
      renderSidebar()

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toBeInTheDocument()
    })

    test('should have navigation element', () => {
      renderSidebar()

      const nav = screen.getByRole('navigation')
      expect(nav).toBeInTheDocument()
    })

    test('should have proper aria-label on toggle button', () => {
      renderSidebar()

      const toggleButton = screen.getByRole('button', {
        name: /collapse sidebar/i,
      })
      expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar')
    })

    test('should have proper aria-label on sign out button', () => {
      renderSidebar({}, true)

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      expect(signOutButton).toHaveAttribute('aria-label', 'Sign Out')
    })
  })

  describe('CSS Transition', () => {
    test('should have transition classes for width animation', () => {
      renderSidebar()

      const sidebar = screen.getByRole('complementary')
      expect(sidebar).toHaveClass('transition-[width]')
      expect(sidebar).toHaveClass('duration-300')
      expect(sidebar).toHaveClass('ease-out')
    })
  })

  describe('Boards Section Toggle', () => {
    test('should toggle Boards section when header is clicked', () => {
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

    // Value: protects=a screen reader hears whether the links of the Boards section are shown; fails_when=aria-expanded leaves the Boards header or stops following the click; why_new=the toggle test above checks that the links disappear, not the state assistive technology reads; seam=none; no_claim=how a screen reader announces the state (attribute only)
    test('tells a screen reader whether the Boards links are shown: the header says expanded, and collapsed after a click', () => {
      // Arrange
      renderSidebar()
      const boardsHeader = screen.getByRole('button', { name: /boards/i })
      expect(boardsHeader).toHaveAttribute('aria-expanded', 'true')

      // Act
      fireEvent.click(boardsHeader)

      // Assert
      expect(boardsHeader).toHaveAttribute('aria-expanded', 'false')
    })
  })
})

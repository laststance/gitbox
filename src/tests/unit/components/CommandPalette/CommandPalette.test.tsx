/**
 * Unit Test: CommandPalette Component
 *
 * Test targets:
 * - Opening/closing via ⌘K keyboard shortcut
 * - Search filtering of commands
 * - Keyboard navigation (ArrowUp/ArrowDown/Enter)
 * - Command execution
 * - "No commands found" empty state
 * - Category grouping display
 * - Escape key and backdrop click to close
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import { CommandPalette } from '@/components/CommandPalette/CommandPalette'
import { getUserRepoPlacements } from '@/lib/actions/board-data'
import { isOverlayOpen } from '@/lib/utils/is-overlay-open'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock framer-motion to avoid animation complexities in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...filterDomProps(props)}>{children}</div>
    ),
  },
  m: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...filterDomProps(props)}>{children}</div>
    ),
  },
  LazyMotion: ({ children }: React.PropsWithChildren): React.ReactNode =>
    children,
  domAnimation: {},
  AnimatePresence: ({ children }: React.PropsWithChildren): React.ReactNode =>
    children,
  useReducedMotion: () => false,
}))

// Mock server actions
vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn(),
}))

vi.mock('@/lib/actions/board-data', () => ({
  getUserRepoPlacements: vi.fn(async () => ({
    success: true,
    data: { placements: [], savedMemories: null },
  })),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}))

/**
 * Filter out non-DOM props from framer-motion mock to avoid React warnings.
 * @param props - Props object to filter
 * @returns Object with only valid DOM attributes
 */
function filterDomProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const { initial, animate, exit, transition, ...domProps } = props
  return domProps
}

/**
 * Helper to open the command palette via ⌘K.
 */
function openPalette(): void {
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [], savedMemories: null },
    })
  })

  describe('Opening/Closing', () => {
    test('should not be visible initially', () => {
      render(<CommandPalette />)

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    test('should open when ⌘K is pressed', () => {
      render(<CommandPalette />)

      openPalette()

      expect(
        screen.getByPlaceholderText('Search commands...'),
      ).toBeInTheDocument()
    })

    // Value: protects=Z does not undo a drag on the board behind the open command palette; fails_when=the palette loses the mark that tells the guard it is a layer (it has no role that would); why_new=the tests of the guard put elements with a role into the page by hand and never render the palette; seam=framer-motion (mocked for this file, it passes the attribute on as the real one does); no_claim=that Z does nothing while a layer is open, which useKanbanUndo.test.tsx checks
    test('counts as a layer over the page while it is open, and as none before', () => {
      // Arrange
      render(<CommandPalette />)
      expect(isOverlayOpen()).toBe(false)

      // Act
      openPalette()

      // Assert
      expect(isOverlayOpen()).toBe(true)
    })

    test('should open when Ctrl+K is pressed', () => {
      render(<CommandPalette />)

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      expect(
        screen.getByPlaceholderText('Search commands...'),
      ).toBeInTheDocument()
    })

    test('should close when Escape is pressed', () => {
      render(<CommandPalette />)

      openPalette()
      expect(
        screen.getByPlaceholderText('Search commands...'),
      ).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    test('should toggle on repeated ⌘K presses', () => {
      render(<CommandPalette />)

      openPalette()
      expect(
        screen.getByPlaceholderText('Search commands...'),
      ).toBeInTheDocument()

      openPalette()
      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    test('should close when backdrop is clicked', () => {
      render(<CommandPalette />)

      openPalette()
      expect(
        screen.getByPlaceholderText('Search commands...'),
      ).toBeInTheDocument()

      const backdrop = screen.getByTestId('command-palette-backdrop')
      fireEvent.click(backdrop)

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })
  })

  describe('Command Display', () => {
    test('should display all command categories', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Navigation')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    test('should display navigation commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Go to Boards')).toBeInTheDocument()
      expect(screen.getByText('Go to Settings')).toBeInTheDocument()
    })

    test('should display action commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Create New Board')).toBeInTheDocument()
    })

    test('should display settings commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
      expect(screen.getByText('Help & Documentation')).toBeInTheDocument()
      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })

    test('should display keyboard shortcuts on commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('G B')).toBeInTheDocument()
      expect(screen.getByText('G S')).toBeInTheDocument()
      expect(screen.getByText('N')).toBeInTheDocument()
    })

    test('should display ESC hint', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('ESC')).toBeInTheDocument()
    })

    test('should display footer navigation hints', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Navigate')).toBeInTheDocument()
      expect(screen.getByText('Select')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  describe('Search Filtering', () => {
    test('should filter commands by search text', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'board' } })

      expect(screen.getByText('Go to Boards')).toBeInTheDocument()
      expect(screen.getByText('Create New Board')).toBeInTheDocument()
      expect(screen.queryByText('Go to Settings')).not.toBeInTheDocument()
    })

    test('should show "No commands found" when search has no matches', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'xyznonexistent' } })

      expect(screen.getByText('No commands found')).toBeInTheDocument()
    })

    test('should be case-insensitive', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'SETTINGS' } })

      expect(screen.getByText('Go to Settings')).toBeInTheDocument()
    })

    test('should reset search when reopened', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'board' } })

      // Close and reopen
      fireEvent.keyDown(window, { key: 'Escape' })
      openPalette()

      const newInput = screen.getByPlaceholderText('Search commands...')
      expect(newInput).toHaveValue('')
    })
  })

  describe('Keyboard Navigation', () => {
    test('should navigate down with ArrowDown', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // First item should be selected by default (index 0)
      const firstButton = screen.getByText('Go to Boards').closest('button')!
      expect(firstButton.className).toContain('bg-primary')

      // Press ArrowDown to select next
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      const secondButton = screen.getByText('Go to Settings').closest('button')!
      expect(secondButton.className).toContain('bg-primary')
    })

    test('should navigate up with ArrowUp', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // Move down first
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      // Then up
      fireEvent.keyDown(input, { key: 'ArrowUp' })

      const firstButton = screen.getByText('Go to Boards').closest('button')!
      expect(firstButton.className).toContain('bg-primary')
    })

    test('should wrap around at the bottom', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // Get all buttons to know the total count
      const allButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.closest('.max-h-80'))

      // Press ArrowDown enough times to wrap around
      for (let i = 0; i < allButtons.length; i++) {
        fireEvent.keyDown(input, { key: 'ArrowDown' })
      }

      // Should be back at the first item
      const firstButton = screen.getByText('Go to Boards').closest('button')!
      expect(firstButton.className).toContain('bg-primary')
    })

    test('should wrap around at the top', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // Press ArrowUp from first item should wrap to last
      fireEvent.keyDown(input, { key: 'ArrowUp' })

      const lastButton = screen.getByText('Sign Out').closest('button')!
      expect(lastButton.className).toContain('bg-primary')
    })
  })

  describe('Command Execution', () => {
    test('should navigate to /boards when "Go to Boards" is executed', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // First command is selected by default, press Enter
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/boards')
    })

    test('should navigate to /settings when "Go to Settings" is clicked', () => {
      render(<CommandPalette />)

      openPalette()
      const button = screen.getByText('Go to Settings').closest('button')!
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/settings')
    })

    test('should navigate to /boards/new when "Create New Board" is clicked', () => {
      render(<CommandPalette />)

      openPalette()
      const button = screen.getByText('Create New Board').closest('button')!
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/boards/new')
    })

    test('should close palette after command execution via click', () => {
      render(<CommandPalette />)

      openPalette()
      const button = screen.getByText('Go to Boards').closest('button')!
      fireEvent.click(button)

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    test('should close palette after command execution via Enter', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    test('should navigate to /settings when "Go to Settings" is executed via keyboard', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // "Go to Settings" is the 2nd command (index 1)
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/settings')
    })
  })

  describe('Search + Keyboard Interaction', () => {
    test('should reset selection index when search changes', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      // Type search — should reset to index 0
      fireEvent.change(input, { target: { value: 'sign' } })

      // "Sign Out" should be the only result and selected
      const signOutButton = screen.getByText('Sign Out').closest('button')!
      expect(signOutButton.className).toContain('bg-primary')
    })

    test('should execute filtered command on Enter', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // Search for settings
      fireEvent.change(input, { target: { value: 'settings' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/settings')
    })
  })

  describe('Repository search', () => {
    const gitbox = {
      identifier: 'laststance/gitbox' as const,
      boardId: 'board-1',
      boardName: 'Work Projects',
      cardId: '00000000-0000-4000-8000-0000000000c2',
      githubRepoId: 42,
    }

    beforeEach(() => {
      vi.mocked(getUserRepoPlacements).mockResolvedValue({
        success: true,
        data: { placements: [gitbox], savedMemories: null },
      })
    })

    // Value: protects=an empty palette stays the command list, and a matching name opens that card's board; fails_when=every repository is listed before a search, or Enter stays on a command; why_new=the palette had no repository search; seam=none; no_claim=the board scrolling to the card (useRevealLinkedCard)
    test('opens the board of a repository whose name matches the search', async () => {
      // Arrange
      render(<CommandPalette />)
      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // Act
      expect(screen.queryByText('laststance/gitbox')).toBeNull()
      fireEvent.change(input, { target: { value: 'gitbox' } })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('laststance/gitbox')).toBeVisible()
      })
      expect(screen.getByText('Work Projects')).toBeVisible()
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(mockPush).toHaveBeenCalledWith(
        '/board/board-1?card=00000000-0000-4000-8000-0000000000c2',
      )
      expect(screen.queryByPlaceholderText('Search commands...')).toBeNull()
    })

    // Value: protects=Enter runs the command the user highlighted when repositories arrive late; fails_when=the arriving repository takes that row and Enter opens it instead; why_new=placements load after the palette is open; seam=none; no_claim=arrow keys after the list has settled
    test('keeps Go to Settings selected when a matching repository arrives', async () => {
      // Arrange
      let resolvePlacements: (
        result: Awaited<ReturnType<typeof getUserRepoPlacements>>,
      ) => void = () => {}
      vi.mocked(getUserRepoPlacements).mockImplementation(
        async () =>
          new Promise((resolve) => {
            resolvePlacements = resolve
          }),
      )
      render(<CommandPalette />)
      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'settings' } })

      // Act
      await act(async () => {
        resolvePlacements({
          success: true,
          data: {
            placements: [
              {
                ...gitbox,
                boardName: 'Settings Archive',
              },
            ],
            savedMemories: null,
          },
        })
      })

      // Assert
      expect(screen.getByText('laststance/gitbox')).toBeVisible()
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(mockPush).toHaveBeenCalledWith('/settings')
    })

    // Value: protects=reopening the palette does not offer the previous repositories while the new load is still running; fails_when=a card that moved can still be opened from the old list; why_new=placements stay in memory between openings; seam=none; no_claim=a failure before the first list arrives
    test('does not offer the previous repositories while a new load is running', async () => {
      // Arrange
      const pending: Array<
        (result: Awaited<ReturnType<typeof getUserRepoPlacements>>) => void
      > = []
      vi.mocked(getUserRepoPlacements).mockImplementation(
        async () =>
          new Promise((resolve) => {
            pending.push(resolve)
          }),
      )
      render(<CommandPalette />)
      openPalette()
      await act(async () => {
        pending[0]?.({
          success: true,
          data: { placements: [gitbox], savedMemories: null },
        })
      })
      fireEvent.change(screen.getByPlaceholderText('Search commands...'), {
        target: { value: 'gitbox' },
      })
      expect(screen.getByText('laststance/gitbox')).toBeVisible()
      fireEvent.keyDown(window, { key: 'Escape' })
      openPalette()

      // Act: search again before the new load answers
      fireEvent.change(screen.getByPlaceholderText('Search commands...'), {
        target: { value: 'gitbox' },
      })

      // Assert
      expect(screen.queryByText('laststance/gitbox')).toBeNull()
      expect(screen.getByText('No commands found')).toBeVisible()
    })

    // Value: protects=the command list stays usable when the repository request rejects; fails_when=the rejection is unhandled or the palette stays stuck loading; why_new=only a returned failure was handled; seam=none; no_claim=a rejection after the palette has closed
    test('leaves the commands usable when loading repositories fails on the way', async () => {
      // Arrange
      vi.mocked(getUserRepoPlacements).mockRejectedValue(new Error('network'))
      render(<CommandPalette />)
      openPalette()

      // Act
      fireEvent.change(screen.getByPlaceholderText('Search commands...'), {
        target: { value: 'gitbox' },
      })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No commands found')).toBeVisible()
      })
    })

    // Value: protects=a board name finds the repository that sits on it; fails_when=only the owner/name is searched; why_new=the question is which board holds the repository; seam=none; no_claim=more than eight matches
    test('finds a repository by the name of the board that holds it', async () => {
      // Arrange
      render(<CommandPalette />)
      openPalette()

      // Act
      fireEvent.change(screen.getByPlaceholderText('Search commands...'), {
        target: { value: 'work projects' },
      })

      // Assert
      await waitFor(() => {
        expect(screen.getByText('laststance/gitbox')).toBeVisible()
      })
    })
  })
})

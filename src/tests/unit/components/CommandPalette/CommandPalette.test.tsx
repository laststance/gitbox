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

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { CommandPalette } from '@/components/CommandPalette/CommandPalette'

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
  AnimatePresence: ({ children }: React.PropsWithChildren): React.ReactNode =>
    children,
  useReducedMotion: () => false,
}))

// Mock server actions
vi.mock('@/lib/actions/auth', () => ({
  signOut: vi.fn(),
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
function openPalette() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Opening/Closing', () => {
    it('should not be visible initially', () => {
      render(<CommandPalette />)

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    it('should open when ⌘K is pressed', () => {
      render(<CommandPalette />)

      openPalette()

      expect(
        screen.getByPlaceholderText('Search commands...'),
      ).toBeInTheDocument()
    })

    it('should open when Ctrl+K is pressed', () => {
      render(<CommandPalette />)

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

      expect(
        screen.getByPlaceholderText('Search commands...'),
      ).toBeInTheDocument()
    })

    it('should close when Escape is pressed', () => {
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

    it('should toggle on repeated ⌘K presses', () => {
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

    it('should close when backdrop is clicked', () => {
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
    it('should display all command categories', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Navigation')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should display navigation commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Go to Boards')).toBeInTheDocument()
      expect(screen.getByText('Go to Maintenance')).toBeInTheDocument()
      expect(screen.getByText('Go to Settings')).toBeInTheDocument()
    })

    it('should display action commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Create New Board')).toBeInTheDocument()
    })

    it('should display settings commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
      expect(screen.getByText('Help & Documentation')).toBeInTheDocument()
      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })

    it('should display keyboard shortcuts on commands', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('G B')).toBeInTheDocument()
      expect(screen.getByText('G M')).toBeInTheDocument()
      expect(screen.getByText('G S')).toBeInTheDocument()
      expect(screen.getByText('N')).toBeInTheDocument()
    })

    it('should display ESC hint', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('ESC')).toBeInTheDocument()
    })

    it('should display footer navigation hints', () => {
      render(<CommandPalette />)

      openPalette()

      expect(screen.getByText('Navigate')).toBeInTheDocument()
      expect(screen.getByText('Select')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })

  describe('Search Filtering', () => {
    it('should filter commands by search text', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'board' } })

      expect(screen.getByText('Go to Boards')).toBeInTheDocument()
      expect(screen.getByText('Create New Board')).toBeInTheDocument()
      expect(screen.queryByText('Go to Maintenance')).not.toBeInTheDocument()
    })

    it('should show "No commands found" when search has no matches', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'xyznonexistent' } })

      expect(screen.getByText('No commands found')).toBeInTheDocument()
    })

    it('should be case-insensitive', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.change(input, { target: { value: 'MAINTENANCE' } })

      expect(screen.getByText('Go to Maintenance')).toBeInTheDocument()
    })

    it('should reset search when reopened', () => {
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
    it('should navigate down with ArrowDown', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // First item should be selected by default (index 0)
      const firstButton = screen.getByText('Go to Boards').closest('button')!
      expect(firstButton.className).toContain('bg-primary')

      // Press ArrowDown to select next
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      const secondButton = screen
        .getByText('Go to Maintenance')
        .closest('button')!
      expect(secondButton.className).toContain('bg-primary')
    })

    it('should navigate up with ArrowUp', () => {
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

    it('should wrap around at the bottom', () => {
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

    it('should wrap around at the top', () => {
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
    it('should navigate to /boards when "Go to Boards" is executed', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // First command is selected by default, press Enter
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/boards')
    })

    it('should navigate to /maintenance when "Go to Maintenance" is clicked', () => {
      render(<CommandPalette />)

      openPalette()
      const button = screen.getByText('Go to Maintenance').closest('button')!
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/maintenance')
    })

    it('should navigate to /boards/new when "Create New Board" is clicked', () => {
      render(<CommandPalette />)

      openPalette()
      const button = screen.getByText('Create New Board').closest('button')!
      fireEvent.click(button)

      expect(mockPush).toHaveBeenCalledWith('/boards/new')
    })

    it('should close palette after command execution via click', () => {
      render(<CommandPalette />)

      openPalette()
      const button = screen.getByText('Go to Boards').closest('button')!
      fireEvent.click(button)

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    it('should close palette after command execution via Enter', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(
        screen.queryByPlaceholderText('Search commands...'),
      ).not.toBeInTheDocument()
    })

    it('should navigate to /settings when "Go to Settings" is executed via keyboard', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // "Go to Settings" is the 3rd command (index 2)
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/settings')
    })
  })

  describe('Search + Keyboard Interaction', () => {
    it('should reset selection index when search changes', () => {
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

    it('should execute filtered command on Enter', () => {
      render(<CommandPalette />)

      openPalette()
      const input = screen.getByPlaceholderText('Search commands...')

      // Search for maintenance
      fireEvent.change(input, { target: { value: 'maintenance' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockPush).toHaveBeenCalledWith('/maintenance')
    })
  })
})

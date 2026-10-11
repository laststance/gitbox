/**
 * Unit Test: OverflowMenu Component
 *
 * Test targets:
 * - Menu rendering and open/close behavior
 * - Board menu items (Move to Another Board, Remove from Board)
 * - URL opening functionality
 * - Remove from Board confirmation dialog
 * - Callback invocations
 * - Accessibility
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memo, useState } from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import { OverflowMenu } from '@/components/Board/OverflowMenu'
import { toRepoCardId, type RepoCardId } from '@/lib/types/brands'

/**
 * One column with the cards card-1 (laststance/gitbox, with its menu) and
 * card-2 (laststance/docs), marked the way the board page marks them. The
 * menu opens and closes as on the page.
 */
const ColumnWithCardMenu = memo(function ColumnWithCardMenu({
  onRemove,
}: {
  onRemove: (cardId: RepoCardId) => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div data-status-column-id="status-1">
      <div
        tabIndex={0}
        data-repo-card-id="card-1"
        aria-label="laststance/gitbox"
      >
        <OverflowMenu
          cardId={toRepoCardId('card-1')}
          repoOwner="laststance"
          repoName="gitbox"
          open={isMenuOpen}
          onOpenChange={(open) => setIsMenuOpen(open)}
          onRemove={onRemove}
        />
      </div>
      <div
        tabIndex={0}
        data-repo-card-id="card-2"
        aria-label="laststance/docs"
      />
    </div>
  )
})

describe('OverflowMenu', () => {
  const mockOnMoveToAnotherBoard = vi.fn()
  const mockOnRemove = vi.fn()
  const mockOnOpenChange = vi.fn()

  // Mock window.open
  const mockWindowOpen = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', mockWindowOpen)
  })

  const defaultProps = {
    cardId: toRepoCardId('card-1'),
    repoOwner: 'laststance',
    repoName: 'gitbox',
    open: false,
    onOpenChange: mockOnOpenChange,
  }

  describe('Menu Trigger', () => {
    test('should render menu trigger button', () => {
      render(<OverflowMenu {...defaultProps} />)

      const trigger = screen.getByTestId('overflow-menu-trigger-card-1')
      expect(trigger).toBeInTheDocument()
    })

    test('should have accessible label for screen readers', () => {
      render(<OverflowMenu {...defaultProps} />)

      expect(screen.getByText('Open menu')).toBeInTheDocument()
    })

    test('should open menu when trigger is clicked', async () => {
      const user = userEvent.setup()
      render(<OverflowMenu {...defaultProps} />)

      await user.click(screen.getByTestId('overflow-menu-trigger-card-1'))

      expect(mockOnOpenChange).toHaveBeenCalledWith(true)
    })
  })

  describe('Menu Content', () => {
    test('should render Open on GitHub item when repoOwner and repoName are provided', () => {
      render(<OverflowMenu {...defaultProps} open={true} />)

      expect(screen.getByText('Open on GitHub')).toBeInTheDocument()
    })

    test('should not render Open on GitHub when owner/name is missing', async () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          repoOwner={undefined}
          repoName={undefined}
        />,
      )

      expect(screen.queryByText('Open on GitHub')).not.toBeInTheDocument()
    })

    test('should render Move to Another Board when the callback is provided', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
        />,
      )

      expect(screen.getByText('Move to Another Board')).toBeInTheDocument()
    })

    test('should render Remove from Board when the callback is provided', () => {
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      expect(screen.getByText('Remove from Board')).toBeInTheDocument()
    })
  })

  describe('Optional URLs', () => {
    test('should render Production URL when provided', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          productionUrl="https://gitbox.example.com"
        />,
      )

      expect(screen.getByText('Open Production URL')).toBeInTheDocument()
    })

    test('should render Tracking dashboard when provided', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          trackingUrl="https://tracking.example.com"
        />,
      )

      expect(screen.getByText('Open Tracking dashboard')).toBeInTheDocument()
    })

    test('should render Supabase dashboard when provided', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          supabaseUrl="https://supabase.example.com"
        />,
      )

      expect(screen.getByText('Open Supabase dashboard')).toBeInTheDocument()
    })
  })

  describe('URL Opening', () => {
    test('should open GitHub URL when clicking Open on GitHub', async () => {
      const user = userEvent.setup()
      render(<OverflowMenu {...defaultProps} open={true} />)

      await user.click(screen.getByText('Open on GitHub'))

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://github.com/laststance/gitbox',
        '_blank',
        'noopener,noreferrer',
      )
    })

    test('should open production URL when clicking', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          productionUrl="https://prod.example.com"
        />,
      )

      await user.click(screen.getByText('Open Production URL'))

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://prod.example.com',
        '_blank',
        'noopener,noreferrer',
      )
    })
  })

  describe('Callback Invocations', () => {
    test('should call onMoveToAnotherBoard when clicked', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
        />,
      )

      await user.click(screen.getByText('Move to Another Board'))

      expect(mockOnMoveToAnotherBoard).toHaveBeenCalledWith('card-1')
    })
  })

  describe('Remove from Board Confirmation Dialog', () => {
    test('should open delete dialog when Remove from Board is clicked', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      await user.click(screen.getByText('Remove from Board'))

      // Dialog should now be visible
      await waitFor(() => {
        expect(
          screen.getByText('Remove Repository from Board?'),
        ).toBeInTheDocument()
      })
    })

    test('should show repository name in delete confirmation', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      await user.click(screen.getByText('Remove from Board'))

      await waitFor(() => {
        expect(screen.getByText('laststance/gitbox')).toBeInTheDocument()
      })
    })

    test('tells the user that Move to Another Board keeps the note, links and comment', async () => {
      // Arrange
      const user = userEvent.setup()
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      // Act
      await user.click(screen.getByText('Remove from Board'))

      // Assert
      const confirmation = await screen.findByRole('alertdialog')
      expect(confirmation).toBeVisible()
      expect(confirmation).toHaveTextContent(
        'permanently deletes its note, links and comment. Adding the repository again will not restore them. To keep them, use Move to Another Board instead.',
      )
    })

    test('should call onRemove when confirmation is accepted', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      await user.click(screen.getByText('Remove from Board'))

      await waitFor(() => {
        expect(
          screen.getByText('Remove Repository from Board?'),
        ).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('confirm-remove-card-1'))

      expect(mockOnRemove).toHaveBeenCalledWith('card-1')
    })

    test('should close dialog when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      await user.click(screen.getByText('Remove from Board'))

      await waitFor(() => {
        expect(
          screen.getByText('Remove Repository from Board?'),
        ).toBeInTheDocument()
      })

      await user.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(
          screen.queryByText('Remove Repository from Board?'),
        ).not.toBeInTheDocument()
      })
    })

    test('should not call onRemove when cancelled', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      await user.click(screen.getByText('Remove from Board'))

      await waitFor(() => {
        expect(
          screen.getByText('Remove Repository from Board?'),
        ).toBeInTheDocument()
      })

      await user.click(screen.getByText('Cancel'))

      expect(mockOnRemove).not.toHaveBeenCalled()
    })

    test('puts the keyboard focus on the next card of the column after a confirmed removal', async () => {
      // Arrange
      const user = userEvent.setup()
      render(<ColumnWithCardMenu onRemove={mockOnRemove} />)
      await user.click(screen.getByTestId('overflow-menu-trigger-card-1'))
      await user.click(await screen.findByText('Remove from Board'))

      // Act
      await user.click(await screen.findByTestId('confirm-remove-card-1'))

      // Assert
      await waitFor(() =>
        expect(screen.getByLabelText('laststance/docs')).toHaveFocus(),
      )
      expect(mockOnRemove).toHaveBeenCalledWith('card-1')
    })

    test('puts the keyboard focus back on the card when the removal is cancelled', async () => {
      // Arrange
      const user = userEvent.setup()
      render(<ColumnWithCardMenu onRemove={mockOnRemove} />)
      await user.click(screen.getByTestId('overflow-menu-trigger-card-1'))
      await user.click(await screen.findByText('Remove from Board'))

      // Act
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))

      // Assert
      await waitFor(() =>
        expect(screen.getByLabelText('laststance/gitbox')).toHaveFocus(),
      )
      expect(mockOnRemove).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    test('should have correct test IDs for automation', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
          onRemove={mockOnRemove}
        />,
      )

      expect(
        screen.getByTestId('overflow-menu-trigger-card-1'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('overflow-menu')).toBeInTheDocument()
      expect(screen.getByTestId('open-github-card-1')).toBeInTheDocument()
      expect(
        screen.getByTestId('move-to-another-board-card-1'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('remove-from-board-card-1')).toBeInTheDocument()
    })

    test('should have destructive styling on Remove button', () => {
      render(
        <OverflowMenu {...defaultProps} open={true} onRemove={mockOnRemove} />,
      )

      const removeButton = screen.getByTestId('remove-from-board-card-1')
      expect(removeButton).toHaveClass('text-destructive')
    })
  })

  describe('Separator Logic', () => {
    test('should render separator between URL items and actions', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
        />,
      )

      // Separator should be present (rendered as hr or role separator)
      const menu = screen.getByTestId('overflow-menu')
      const separators = menu.querySelectorAll('[role="separator"]')
      expect(separators.length).toBeGreaterThan(0)
    })
  })

  /**
   * Regression coverage for the dnd-kit + Radix Portal interaction bug.
   *
   * Background:
   * - `RepoCard` spreads `useSortable` `attributes` and `listeners` on its
   *   wrapper div, making the entire card a drag handle.
   * - Radix renders menu items inside a Portal. React still bubbles synthetic
   *   events from those portal children up through the React tree, so without
   *   isolation `pointerdown` from a menu item would reach `MouseSensor`.
   *   `MouseSensor` would then start a drag on small cursor jitter and
   *   suppress the trailing `click`, leaving the menu item's `onClick`
   *   silently unfired.
   *
   * `OverflowMenu` mounts a `display: contents` wrapper that stops bubbling
   * for pointer / mouse / click / key events. These tests pin that contract.
   */
  describe('Event Propagation Isolation (dnd-kit guard)', () => {
    test('should render an isolation wrapper that catches bubbling events', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
        />,
      )

      const isolation = screen.getByTestId('overflow-menu-isolation-card-1')
      expect(isolation).toBeInTheDocument()
      expect(isolation).toHaveClass('contents')
    })

    test('should stop click bubbling from menu items reaching draggable ancestor', async () => {
      const ancestorClickSpy = vi.fn()
      const ancestorPointerDownSpy = vi.fn()
      const ancestorMouseDownSpy = vi.fn()
      const user = userEvent.setup()

      render(
        // Simulates the draggable wrapper that `useSortable` injects on
        // `RepoCard`. If isolation regresses, these spies will fire.
        <div
          data-testid="draggable-ancestor"
          onClick={ancestorClickSpy}
          onPointerDown={ancestorPointerDownSpy}
          onMouseDown={ancestorMouseDownSpy}
        >
          <OverflowMenu
            {...defaultProps}
            open={true}
            onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
          />
        </div>,
      )

      await user.click(screen.getByTestId('move-to-another-board-card-1'))

      expect(mockOnMoveToAnotherBoard).toHaveBeenCalledWith('card-1')
      expect(ancestorClickSpy).not.toHaveBeenCalled()
      expect(ancestorPointerDownSpy).not.toHaveBeenCalled()
      expect(ancestorMouseDownSpy).not.toHaveBeenCalled()
    })

    test('should stop click bubbling when opening menu via the trigger', async () => {
      const ancestorClickSpy = vi.fn()
      const ancestorPointerDownSpy = vi.fn()
      const user = userEvent.setup()

      render(
        <div
          data-testid="draggable-ancestor"
          onClick={ancestorClickSpy}
          onPointerDown={ancestorPointerDownSpy}
        >
          <OverflowMenu
            {...defaultProps}
            onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
          />
        </div>,
      )

      await user.click(screen.getByTestId('overflow-menu-trigger-card-1'))

      expect(mockOnOpenChange).toHaveBeenCalledWith(true)
      expect(ancestorClickSpy).not.toHaveBeenCalled()
      expect(ancestorPointerDownSpy).not.toHaveBeenCalled()
    })

    test('should stop keyboard events bubbling from the menu trigger', async () => {
      const ancestorKeyDownSpy = vi.fn()
      const user = userEvent.setup()

      render(
        <div data-testid="draggable-ancestor" onKeyDown={ancestorKeyDownSpy}>
          <OverflowMenu
            {...defaultProps}
            onMoveToAnotherBoard={mockOnMoveToAnotherBoard}
          />
        </div>,
      )

      const trigger = screen.getByTestId('overflow-menu-trigger-card-1')
      trigger.focus()
      await user.keyboard('{Enter}')

      expect(ancestorKeyDownSpy).not.toHaveBeenCalled()
    })
  })
})

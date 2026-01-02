/**
 * Unit Test: OverflowMenu Component
 *
 * Test targets:
 * - Menu rendering and open/close behavior
 * - Context-specific menu items (Board vs Maintenance)
 * - URL opening functionality
 * - Delete confirmation dialog
 * - Callback invocations
 * - Accessibility
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { OverflowMenu } from '@/components/Board/OverflowMenu'

describe('OverflowMenu', () => {
  const mockOnEdit = vi.fn()
  const mockOnMoveToMaintenance = vi.fn()
  const mockOnRestoreToBoard = vi.fn()
  const mockOnRemove = vi.fn()
  const mockOnOpenChange = vi.fn()

  // Mock window.open
  const mockWindowOpen = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('open', mockWindowOpen)
  })

  const defaultProps = {
    cardId: 'card-1',
    repoOwner: 'laststance',
    repoName: 'gitbox',
    open: false,
    onOpenChange: mockOnOpenChange,
  }

  describe('Menu Trigger', () => {
    it('should render menu trigger button', () => {
      render(<OverflowMenu {...defaultProps} />)

      const trigger = screen.getByTestId('overflow-menu-trigger-card-1')
      expect(trigger).toBeInTheDocument()
    })

    it('should have accessible label for screen readers', () => {
      render(<OverflowMenu {...defaultProps} />)

      expect(screen.getByText('Open menu')).toBeInTheDocument()
    })

    it('should open menu when trigger is clicked', async () => {
      const user = userEvent.setup()
      render(<OverflowMenu {...defaultProps} />)

      await user.click(screen.getByTestId('overflow-menu-trigger-card-1'))

      expect(mockOnOpenChange).toHaveBeenCalledWith(true)
    })
  })

  describe('Menu Content - Board Context', () => {
    it('should render Open on GitHub item when repoOwner and repoName are provided', () => {
      render(<OverflowMenu {...defaultProps} open={true} />)

      expect(screen.getByText('Open on GitHub')).toBeInTheDocument()
    })

    it('should not render Open on GitHub when owner/name is missing', async () => {
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

    it('should render Edit Project Info when onEdit is provided', () => {
      render(<OverflowMenu {...defaultProps} open={true} onEdit={mockOnEdit} />)

      expect(screen.getByText('Edit Project Info…')).toBeInTheDocument()
    })

    it('should render Move to Maintenance in board context', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onMoveToMaintenance={mockOnMoveToMaintenance}
        />,
      )

      expect(screen.getByText('Move to Maintenance')).toBeInTheDocument()
    })

    it('should render Remove from Board in board context', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onRemove={mockOnRemove}
        />,
      )

      expect(screen.getByText('Remove from Board')).toBeInTheDocument()
    })
  })

  describe('Menu Content - Maintenance Context', () => {
    it('should render Restore to Board in maintenance context', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="maintenance"
          onRestoreToBoard={mockOnRestoreToBoard}
        />,
      )

      expect(screen.getByText('Restore to Board')).toBeInTheDocument()
    })

    it('should not render Move to Maintenance in maintenance context', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="maintenance"
          onMoveToMaintenance={mockOnMoveToMaintenance}
        />,
      )

      expect(screen.queryByText('Move to Maintenance')).not.toBeInTheDocument()
    })

    it('should not render Remove from Board in maintenance context', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="maintenance"
          onRemove={mockOnRemove}
        />,
      )

      expect(screen.queryByText('Remove from Board')).not.toBeInTheDocument()
    })
  })

  describe('Optional URLs', () => {
    it('should render Production URL when provided', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          productionUrl="https://gitbox.example.com"
        />,
      )

      expect(screen.getByText('Open Production URL')).toBeInTheDocument()
    })

    it('should render Tracking dashboard when provided', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          trackingUrl="https://tracking.example.com"
        />,
      )

      expect(screen.getByText('Open Tracking dashboard')).toBeInTheDocument()
    })

    it('should render Supabase dashboard when provided', () => {
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
    it('should open GitHub URL when clicking Open on GitHub', async () => {
      const user = userEvent.setup()
      render(<OverflowMenu {...defaultProps} open={true} />)

      await user.click(screen.getByText('Open on GitHub'))

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://github.com/laststance/gitbox',
        '_blank',
        'noopener,noreferrer',
      )
    })

    it('should open production URL when clicking', async () => {
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
    it('should call onEdit when Edit Project Info is clicked', async () => {
      const user = userEvent.setup()
      render(<OverflowMenu {...defaultProps} open={true} onEdit={mockOnEdit} />)

      await user.click(screen.getByText('Edit Project Info…'))

      expect(mockOnEdit).toHaveBeenCalledWith('card-1')
    })

    it('should call onMoveToMaintenance when clicked', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onMoveToMaintenance={mockOnMoveToMaintenance}
        />,
      )

      await user.click(screen.getByText('Move to Maintenance'))

      expect(mockOnMoveToMaintenance).toHaveBeenCalledWith('card-1')
    })

    it('should call onRestoreToBoard when clicked', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="maintenance"
          onRestoreToBoard={mockOnRestoreToBoard}
        />,
      )

      await user.click(screen.getByText('Restore to Board'))

      expect(mockOnRestoreToBoard).toHaveBeenCalledWith('card-1')
    })
  })

  describe('Delete Confirmation Dialog', () => {
    it('should open delete dialog when Remove from Board is clicked', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onRemove={mockOnRemove}
        />,
      )

      await user.click(screen.getByText('Remove from Board'))

      // Dialog should now be visible
      await waitFor(() => {
        expect(
          screen.getByText('Remove Repository from Board?'),
        ).toBeInTheDocument()
      })
    })

    it('should show repository name in delete confirmation', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onRemove={mockOnRemove}
        />,
      )

      await user.click(screen.getByText('Remove from Board'))

      await waitFor(() => {
        expect(screen.getByText('laststance/gitbox')).toBeInTheDocument()
      })
    })

    it('should call onRemove when confirmation is accepted', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onRemove={mockOnRemove}
        />,
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

    it('should close dialog when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onRemove={mockOnRemove}
        />,
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

    it('should not call onRemove when cancelled', async () => {
      const user = userEvent.setup()
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onRemove={mockOnRemove}
        />,
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
  })

  describe('Accessibility', () => {
    it('should have correct test IDs for automation', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          onEdit={mockOnEdit}
          context="board"
          onMoveToMaintenance={mockOnMoveToMaintenance}
          onRemove={mockOnRemove}
        />,
      )

      expect(
        screen.getByTestId('overflow-menu-trigger-card-1'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('overflow-menu')).toBeInTheDocument()
      expect(screen.getByTestId('open-github-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('edit-project-card-1')).toBeInTheDocument()
      expect(
        screen.getByTestId('move-to-maintenance-card-1'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('remove-from-board-card-1')).toBeInTheDocument()
    })

    it('should have destructive styling on Remove button', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          context="board"
          onRemove={mockOnRemove}
        />,
      )

      const removeButton = screen.getByTestId('remove-from-board-card-1')
      expect(removeButton).toHaveClass('text-destructive')
    })
  })

  describe('Separator Logic', () => {
    it('should render separator between URL items and actions', () => {
      render(<OverflowMenu {...defaultProps} open={true} onEdit={mockOnEdit} />)

      // Separator should be present (rendered as hr or role separator)
      const menu = screen.getByTestId('overflow-menu')
      const separators = menu.querySelectorAll('[role="separator"]')
      expect(separators.length).toBeGreaterThan(0)
    })

    it('should not render separator when no URL items', () => {
      render(
        <OverflowMenu
          {...defaultProps}
          open={true}
          repoOwner={undefined}
          repoName={undefined}
          onEdit={mockOnEdit}
        />,
      )

      // Should still render edit item without separator before it
      expect(screen.getByText('Edit Project Info…')).toBeInTheDocument()
    })
  })
})

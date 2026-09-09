/**
 * Unit Test: DeleteBoardDialog Component
 *
 * Test targets:
 * - Dialog rendering when open/closed
 * - Destructive confirmation content (title, description, board name)
 * - Cancel button behavior
 * - Delete button text and aria-label
 * - Hidden boardId input
 * - Accessibility (alert dialog roles)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

import { DeleteBoardDialog } from '@/components/Boards/DeleteBoardDialog'

// Mock server actions
vi.mock('@/lib/actions/board', () => ({
  deleteBoardAction: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('DeleteBoardDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnDeleteSuccess = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onDeleteSuccess: mockOnDeleteSuccess,
    boardId: 'board-123',
    boardName: 'Test Board',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dialog Rendering', () => {
    test('should render the alert dialog when isOpen is true', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const dialog = screen.getByRole('alertdialog')
      expect(dialog).toBeInTheDocument()
    })

    test('should not render the dialog when isOpen is false', () => {
      render(<DeleteBoardDialog {...defaultProps} isOpen={false} />)

      const dialog = screen.queryByRole('alertdialog')
      expect(dialog).not.toBeInTheDocument()
    })

    test('should display "Delete Board" as the title', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      expect(
        screen.getByRole('heading', { name: /delete board/i }),
      ).toBeInTheDocument()
    })

    test('should display the board name in the description', () => {
      render(<DeleteBoardDialog {...defaultProps} boardName="My Project" />)

      expect(
        screen.getByText(/Are you sure you want to delete "My Project"/),
      ).toBeInTheDocument()
    })

    test('should warn about permanent removal', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      expect(
        screen.getByText(/This action cannot be undone/),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/All columns and cards will be permanently removed/),
      ).toBeInTheDocument()
    })
  })

  describe('Buttons', () => {
    test('should display Cancel button', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeInTheDocument()
    })

    test('should display Delete Board button', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const deleteButton = screen.getByRole('button', {
        name: /delete board test board/i,
      })
      expect(deleteButton).toBeInTheDocument()
      expect(deleteButton).toHaveTextContent('Delete Board')
    })

    test('should have destructive variant on delete button', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const deleteButton = screen.getByRole('button', {
        name: /delete board test board/i,
      })
      // shadcn destructive variant uses 'destructive' class
      expect(deleteButton.className).toContain('destructive')
    })

    test('should have correct aria-label on delete button', () => {
      render(<DeleteBoardDialog {...defaultProps} boardName="My Board" />)

      const deleteButton = screen.getByRole('button', {
        name: 'Delete board My Board',
      })
      expect(deleteButton).toBeInTheDocument()
    })
  })

  describe('Form', () => {
    test('should contain a hidden boardId input', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const hiddenInput = document.querySelector(
        'input[type="hidden"][name="boardId"]',
      )
      expect(hiddenInput).toBeInTheDocument()
      expect(hiddenInput).toHaveValue('board-123')
    })

    test('should have a form element wrapping the delete button', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const deleteButton = screen.getByRole('button', {
        name: /delete board test board/i,
      })
      expect(deleteButton.closest('form')).toBeInTheDocument()
    })
  })

  describe('Close Behavior', () => {
    test('should call onClose when Cancel is clicked', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    test('should handle special characters in board name', () => {
      render(
        <DeleteBoardDialog
          {...defaultProps}
          boardName='Project "Alpha" & <Beta>'
        />,
      )

      expect(
        screen.getByText(
          /Are you sure you want to delete "Project "Alpha" & <Beta>"/,
        ),
      ).toBeInTheDocument()
    })

    test('should handle empty board name', () => {
      render(<DeleteBoardDialog {...defaultProps} boardName="" />)

      const dialog = screen.getByRole('alertdialog')
      expect(dialog).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('should use alertdialog role', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    test('should have accessible heading', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const heading = screen.getByRole('heading', { name: /delete board/i })
      expect(heading).toBeInTheDocument()
    })

    test('should have submit button with type="submit"', () => {
      render(<DeleteBoardDialog {...defaultProps} />)

      const deleteButton = screen.getByRole('button', {
        name: /delete board test board/i,
      })
      expect(deleteButton).toHaveAttribute('type', 'submit')
    })
  })
})

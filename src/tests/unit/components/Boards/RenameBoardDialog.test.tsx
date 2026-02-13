/**
 * Unit Test: RenameBoardDialog Component
 *
 * Test targets:
 * - Dialog rendering when open/closed
 * - Input displays current board name
 * - Character count display and near-limit warning
 * - Empty/whitespace name disables submit
 * - Cancel button behavior
 * - Props sync when currentName changes
 * - Accessibility (aria attributes, form structure)
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { RenameBoardDialog } from '@/components/Boards/RenameBoardDialog'

// Mock server actions
vi.mock('@/lib/actions/board', () => ({
  renameBoardAction: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('RenameBoardDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnRenameSuccess = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onRenameSuccess: mockOnRenameSuccess,
    boardId: 'board-123',
    currentName: 'Test Board',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Dialog Rendering', () => {
    it('should render the dialog when isOpen is true', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
    })

    it('should not render the dialog when isOpen is false', () => {
      render(<RenameBoardDialog {...defaultProps} isOpen={false} />)

      const dialog = screen.queryByRole('dialog')
      expect(dialog).not.toBeInTheDocument()
    })

    it('should display "Rename Board" as the title', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      // There are multiple h2s (visually hidden a11y title + visible title)
      const headings = screen.getAllByRole('heading', { name: /rename board/i })
      expect(headings.length).toBeGreaterThanOrEqual(1)
    })

    it('should display the description text', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      expect(
        screen.getByText('Enter a new name for this board.'),
      ).toBeInTheDocument()
    })
  })

  describe('Input Field', () => {
    it('should display the current board name in input', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('Test Board')
    })

    it('should update input value when typed', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New Board Name' } })

      expect(input).toHaveValue('New Board Name')
    })

    it('should have maxLength attribute set to 50', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('maxLength', '50')
    })

    it('should have placeholder text', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByPlaceholderText('Board name')
      expect(input).toBeInTheDocument()
    })

    it('should have autoComplete disabled', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('autoComplete', 'off')
    })
  })

  describe('Character Count', () => {
    it('should display character count', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      // "Test Board" is 10 characters, max is 50
      expect(screen.getByText('10/50')).toBeInTheDocument()
    })

    it('should update character count when typing', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'Short' } })

      expect(screen.getByText('5/50')).toBeInTheDocument()
    })

    it('should show warning color when approaching character limit', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      const longName = 'a'.repeat(42) // 42 chars, within 10 of 50 limit
      fireEvent.change(input, { target: { value: longName } })

      const charCount = screen.getByText('42/50')
      expect(charCount).toHaveClass('text-orange-500')
    })

    it('should not show warning color when under threshold', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const charCount = screen.getByText('10/50')
      expect(charCount).not.toHaveClass('text-orange-500')
      expect(charCount).toHaveClass('text-muted-foreground')
    })

    it('should display 0/50 when input is empty', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '' } })

      expect(screen.getByText('0/50')).toBeInTheDocument()
    })

    it('should display max count at limit', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'a'.repeat(50) } })

      expect(screen.getByText('50/50')).toBeInTheDocument()
    })
  })

  describe('Submit Button', () => {
    it('should display Rename button', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const renameButton = screen.getByRole('button', {
        name: /rename board to/i,
      })
      expect(renameButton).toBeInTheDocument()
      expect(renameButton).toHaveTextContent('Rename')
    })

    it('should disable Rename button when name is empty', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '' } })

      const renameButton = screen.getByRole('button', {
        name: /rename board to/i,
      })
      expect(renameButton).toBeDisabled()
    })

    it('should disable Rename button when name is only whitespace', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '   ' } })

      const renameButton = screen.getByRole('button', {
        name: /rename board to/i,
      })
      expect(renameButton).toBeDisabled()
    })

    it('should enable Rename button when name is valid', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'Valid Name' } })

      const renameButton = screen.getByRole('button', {
        name: /rename board to valid name/i,
      })
      expect(renameButton).not.toBeDisabled()
    })

    it('should have correct aria-label reflecting current input', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New Name' } })

      const renameButton = screen.getByRole('button', {
        name: 'Rename board to New Name',
      })
      expect(renameButton).toBeInTheDocument()
    })
  })

  describe('Cancel Button', () => {
    it('should display Cancel button', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeInTheDocument()
    })

    it('should call onClose when Cancel is clicked', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Form Structure', () => {
    it('should contain a hidden boardId input', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const hiddenInput = document.querySelector(
        'input[type="hidden"][name="boardId"]',
      )
      expect(hiddenInput).toBeInTheDocument()
      expect(hiddenInput).toHaveValue('board-123')
    })

    it('should have name input with name="name"', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('name', 'name')
    })

    it('should have a form wrapping the inputs', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      expect(input.closest('form')).toBeInTheDocument()
    })
  })

  describe('Props Sync', () => {
    it('should sync name when currentName prop changes', () => {
      const { rerender } = render(<RenameBoardDialog {...defaultProps} />)

      expect(screen.getByRole('textbox')).toHaveValue('Test Board')

      rerender(
        <RenameBoardDialog {...defaultProps} currentName="Updated Board" />,
      )

      expect(screen.getByRole('textbox')).toHaveValue('Updated Board')
    })

    it('should update character count when currentName prop changes', () => {
      const { rerender } = render(<RenameBoardDialog {...defaultProps} />)

      expect(screen.getByText('10/50')).toBeInTheDocument()

      rerender(<RenameBoardDialog {...defaultProps} currentName="AB" />)

      expect(screen.getByText('2/50')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in board name', () => {
      render(
        <RenameBoardDialog
          {...defaultProps}
          currentName='Project "Alpha" & <Beta>'
        />,
      )

      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('Project "Alpha" & <Beta>')
    })

    it('should handle max length board name', () => {
      const longName = 'A'.repeat(50)
      render(<RenameBoardDialog {...defaultProps} currentName={longName} />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveValue(longName)
      expect(screen.getByText('50/50')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should use dialog role', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have accessible heading', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      // There are multiple h2s (visually hidden a11y title + visible title)
      const headings = screen.getAllByRole('heading', { name: /rename board/i })
      expect(headings.length).toBeGreaterThanOrEqual(1)
    })

    it('should have submit button with type="submit"', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const renameButton = screen.getByRole('button', {
        name: /rename board to/i,
      })
      expect(renameButton).toHaveAttribute('type', 'submit')
    })

    it('should have aria-describedby on input', () => {
      render(<RenameBoardDialog {...defaultProps} />)

      const input = screen.getByRole('textbox')
      // When no error, input is described by char count
      expect(input).toHaveAttribute('aria-describedby', 'name-char-count')
    })
  })
})

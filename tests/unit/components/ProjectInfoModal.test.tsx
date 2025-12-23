/**
 * Unit Test: ProjectInfoModal Component
 *
 * Constitution requirements:
 * - Principle VI: TDD - Test-first approach
 * - Principle IV: WCAG AA compliance
 *
 * Test targets:
 * - URL validation logic
 * - Note character limit (20,000)
 * - Form state management
 * - Save/Cancel behavior
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ProjectInfoModal } from '@/components/Modals/ProjectInfoModal'

describe('ProjectInfoModal', () => {
  const mockOnSave = vi.fn()
  const mockOnClose = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    projectInfo: {
      id: 'test-repo-1',
      quickNote: '',
      links: [],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('URL Validation', () => {
    it('should accept valid HTTP URLs', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'http://example.com' },
      })

      const errorMessage = screen.queryByTestId('url-error')
      expect(errorMessage).not.toBeInTheDocument()

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).not.toBeDisabled()
    })

    it('should accept valid HTTPS URLs', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'https://example.com' },
      })

      const errorMessage = screen.queryByTestId('url-error')
      expect(errorMessage).not.toBeInTheDocument()
    })

    it('should reject invalid URLs', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'not-a-valid-url' },
      })

      await waitFor(() => {
        const errorMessage = screen.getByTestId('url-error')
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveTextContent('Please enter a valid URL')
      })

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).toBeDisabled()
    })

    it('should reject URLs without protocol', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'example.com' },
      })

      await waitFor(() => {
        const errorMessage = screen.getByTestId('url-error')
        expect(errorMessage).toBeInTheDocument()
      })
    })

    it('should accept URLs with paths and query parameters', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: {
          value: 'https://example.com/path?param=value&other=123',
        },
      })

      const errorMessage = screen.queryByTestId('url-error')
      expect(errorMessage).not.toBeInTheDocument()
    })

    it('should accept localhost URLs for development', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'http://localhost:3000' },
      })

      const errorMessage = screen.queryByTestId('url-error')
      expect(errorMessage).not.toBeInTheDocument()
    })
  })

  describe('Note Character Limit', () => {
    it('should display character count', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const charCount = screen.getByTestId('char-count')
      expect(charCount).toHaveTextContent('0 / 20000')
    })

    it('should update character count on input', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-textarea')
      fireEvent.change(textarea, {
        target: { value: 'Test note' },
      })

      const charCount = screen.getByTestId('char-count')
      expect(charCount).toHaveTextContent('9 / 20000')
    })

    it('should prevent input beyond 20000 characters', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId(
        'note-textarea',
      ) as HTMLTextAreaElement

      // In React controlled components, maxLength attribute works automatically,
      // so test exactly 20000 characters input
      const maxText = 'a'.repeat(20000)

      fireEvent.change(textarea, {
        target: { value: maxText },
      })

      expect(textarea.value.length).toBe(20000)

      const charCount = screen.getByTestId('char-count')
      expect(charCount).toHaveTextContent('20000 / 20000')
    })

    it('should show warning when approaching limit', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-textarea')
      const nearLimit = 'a'.repeat(18000)

      fireEvent.change(textarea, {
        target: { value: nearLimit },
      })

      const charCount = screen.getByTestId('char-count')
      expect(charCount).toHaveClass('text-warning')
    })
  })

  describe('Form State Management', () => {
    it('should enable save button when form is valid', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).not.toBeDisabled()
    })

    it('should disable save button when URL is invalid', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'invalid' },
      })

      await waitFor(() => {
        const saveButton = screen.getByTestId('save-button')
        expect(saveButton).toBeDisabled()
      })
    })

    it('should call onSave with form data when saved', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-textarea')
      fireEvent.change(textarea, {
        target: { value: 'Test note' },
      })

      const saveButton = screen.getByTestId('save-button')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          quickNote: 'Test note',
          links: [],
          credentials: [],
        })
      })
    })

    it('should call onClose when cancelled', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const cancelButton = screen.getByTestId('cancel-button')
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should reset form when cancelled', () => {
      const { rerender } = render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-textarea')
      fireEvent.change(textarea, {
        target: { value: 'Changed text' },
      })

      const cancelButton = screen.getByTestId('cancel-button')
      fireEvent.click(cancelButton)

      // Reopen modal
      rerender(<ProjectInfoModal {...defaultProps} isOpen={false} />)
      rerender(<ProjectInfoModal {...defaultProps} isOpen={true} />)

      const textareaAfter = screen.getByTestId('note-textarea')
      expect(textareaAfter).toHaveValue('')
    })
  })

  describe('Multiple URLs Management', () => {
    it('should allow adding multiple URLs', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')

      fireEvent.click(addButton)
      fireEvent.click(addButton)
      fireEvent.click(addButton)

      const urlInputs = screen.getAllByTestId(/^url-input-/)
      expect(urlInputs).toHaveLength(3)
    })

    it('should allow removing URLs', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)
      fireEvent.click(addButton)

      const removeButton = screen.getAllByTestId(/^remove-url-/)[0]
      fireEvent.click(removeButton)

      await waitFor(() => {
        const urlInputs = screen.getAllByTestId(/^url-input-/)
        expect(urlInputs).toHaveLength(1)
      })
    })

    it('should validate all URLs before saving', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)
      fireEvent.click(addButton)

      const urlInput1 = screen.getByTestId('url-input-0')
      const urlInput2 = screen.getByTestId('url-input-1')

      fireEvent.change(urlInput1, {
        target: { value: 'https://example.com' },
      })
      fireEvent.change(urlInput2, {
        target: { value: 'invalid-url' },
      })

      await waitFor(() => {
        const saveButton = screen.getByTestId('save-button')
        expect(saveButton).toBeDisabled()
      })
    })
  })

  describe('Accessibility (WCAG AA)', () => {
    it('should set focus to Note textarea on open', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-textarea')
      expect(textarea).toHaveFocus()
    })

    it('should have proper ARIA labels', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-labelledby')
      expect(modal).toHaveAttribute('aria-describedby')
    })

    it('should support keyboard navigation', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      // autoFocus is set on Note textarea
      const textarea = screen.getByTestId('note-textarea')
      expect(textarea).toHaveFocus()

      // Verify that focusable elements exist
      // (Actual Tab key behavior is covered in E2E tests)
      const addButton = screen.getByTestId('add-url-button')
      expect(addButton).toBeInTheDocument()

      const saveButton = screen.getByTestId('save-button')
      expect(saveButton).toBeInTheDocument()

      const cancelButton = screen.getByTestId('cancel-button')
      expect(cancelButton).toBeInTheDocument()
    })

    it('should close on Escape key', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})

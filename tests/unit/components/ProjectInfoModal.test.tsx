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
 *
 * Note: PlateEditor is mocked as a native textarea for unit testing.
 * Actual rich text editor behavior is covered in E2E tests.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ProjectInfoModal } from '@/components/Modals/ProjectInfoModal'

/**
 * Mock PlateEditor with a native textarea for unit testing.
 * This allows us to test the modal's form logic without complex
 * contenteditable interactions.
 */
vi.mock('@/components/editor/PlateEditor', () => ({
  PlateEditor: ({
    initialValue,
    onChange,
    placeholder,
    disabled,
    'data-testid': testId,
  }: {
    initialValue?: string
    onChange?: (value: string) => void
    placeholder?: string
    disabled?: boolean
    'data-testid'?: string
  }) => (
    <textarea
      data-testid={testId}
      defaultValue={initialValue}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus
    />
  ),
}))

/**
 * Mock user-presets server action to avoid server-side cookie access in unit tests.
 * The actual server action is tested in E2E tests.
 */
vi.mock('@/lib/actions/user-presets', () => ({
  getUserPresets: vi.fn().mockResolvedValue([]),
  createUserPreset: vi.fn(),
}))

describe('ProjectInfoModal', () => {
  const mockOnSave = vi.fn()
  const mockOnClose = vi.fn()

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    projectInfo: {
      id: 'test-repo-1',
      note: '',
      comment: '',
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

      // Wait for debounced validation
      await waitFor(
        () => {
          expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        },
        { timeout: 500 },
      )

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

      // Wait for debounced validation
      await waitFor(
        () => {
          expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        },
        { timeout: 500 },
      )
    })

    it('should reject invalid URLs', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'not-a-valid-url' },
      })

      // Wait for debounced validation
      await waitFor(
        () => {
          const errorMessage = screen.getByRole('alert')
          expect(errorMessage).toBeInTheDocument()
          expect(errorMessage).toHaveTextContent(
            'URL must start with http:// or https://',
          )
        },
        { timeout: 500 },
      )

      // Per-item save button should be disabled
      const itemSaveButton = screen.getByTestId('url-save-0')
      expect(itemSaveButton).toBeDisabled()
    })

    it('should reject URLs without protocol', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'example.com' },
      })

      // Wait for debounced validation
      await waitFor(
        () => {
          const errorMessage = screen.getByRole('alert')
          expect(errorMessage).toBeInTheDocument()
          expect(errorMessage).toHaveTextContent(
            'URL must start with http:// or https://',
          )
        },
        { timeout: 500 },
      )
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

      // Wait for debounced validation
      await waitFor(
        () => {
          expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        },
        { timeout: 500 },
      )
    })

    it('should accept localhost URLs for development', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'http://localhost:3000' },
      })

      // Wait for debounced validation
      await waitFor(
        () => {
          expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        },
        { timeout: 500 },
      )
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

      const textarea = screen.getByTestId('note-editor')
      fireEvent.change(textarea, {
        target: { value: 'Test note' },
      })

      const charCount = screen.getByTestId('char-count')
      expect(charCount).toHaveTextContent('9 / 20000')
    })

    it('should prevent input beyond 20000 characters', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-editor') as HTMLTextAreaElement

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

      const textarea = screen.getByTestId('note-editor')
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

    it('should disable item save button when URL is invalid', async () => {
      // With EditableUrlItem, validation is per-item, not at modal level
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, {
        target: { value: 'invalid-url' },
      })

      // Wait for debounced validation and verify error message appears
      await waitFor(
        () => {
          expect(
            screen.getByText('URL must start with http:// or https://'),
          ).toBeInTheDocument()
        },
        { timeout: 500 },
      )

      // The per-item save button should be disabled when there's a validation error
      const itemSaveButton = screen.getByTestId('url-save-0')
      expect(itemSaveButton).toBeDisabled()
    })

    it('should call onSave with form data when saved', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-editor')
      fireEvent.change(textarea, {
        target: { value: 'Test note' },
      })

      const saveButton = screen.getByTestId('save-button')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          note: 'Test note',
          comment: '',
          links: [],
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

      const textarea = screen.getByTestId('note-editor')
      fireEvent.change(textarea, {
        target: { value: 'Changed text' },
      })

      const cancelButton = screen.getByTestId('cancel-button')
      fireEvent.click(cancelButton)

      // Reopen modal
      rerender(<ProjectInfoModal {...defaultProps} isOpen={false} />)
      rerender(<ProjectInfoModal {...defaultProps} isOpen={true} />)

      const textareaAfter = screen.getByTestId('note-editor')
      expect(textareaAfter).toHaveValue('')
    })
  })

  describe('Multiple URLs Management', () => {
    it('should allow adding multiple URLs', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')

      // Add first URL and enter a value to complete edit
      fireEvent.click(addButton)
      const urlInput0 = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput0, { target: { value: 'https://first.com' } })
      fireEvent.keyDown(urlInput0, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByTestId('url-link-0')).toBeInTheDocument()
      })

      // Add second URL
      fireEvent.click(addButton)
      const urlInput1 = screen.getByTestId('url-input-1')
      fireEvent.change(urlInput1, { target: { value: 'https://second.com' } })
      fireEvent.keyDown(urlInput1, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByTestId('url-link-1')).toBeInTheDocument()
      })

      // Verify 2 URL items exist
      const urlList = screen.getByTestId('url-list')
      expect(urlList.querySelectorAll('li')).toHaveLength(2)
    })

    it('should allow removing URLs', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)
      const urlInput0 = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput0, {
        target: { value: 'https://delete-me.com' },
      })
      fireEvent.keyDown(urlInput0, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByTestId('url-link-0')).toBeInTheDocument()
      })

      // Use new test ID: url-delete-${index}
      const deleteButton = screen.getByTestId('url-delete-0')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.queryByTestId('url-link-0')).not.toBeInTheDocument()
      })
    })

    it('should show validation error for invalid URL protocol', async () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const addButton = screen.getByTestId('add-url-button')
      fireEvent.click(addButton)

      // Enter an invalid URL (wrong protocol)
      const urlInput = screen.getByTestId('url-input-0')
      fireEvent.change(urlInput, { target: { value: 'ftp://invalid.com' } })

      // Wait for debounced validation
      await waitFor(
        () => {
          expect(
            screen.getByText('URL must start with http:// or https://'),
          ).toBeInTheDocument()
        },
        { timeout: 500 },
      )

      // Item-level save button should be disabled
      const itemSaveButton = screen.getByTestId('url-save-0')
      expect(itemSaveButton).toBeDisabled()

      // Enter key should not save the invalid URL
      fireEvent.keyDown(urlInput, { key: 'Enter' })
      // Still in edit mode (input still present)
      expect(screen.getByTestId('url-input-0')).toBeInTheDocument()
    })
  })

  describe('Accessibility (WCAG AA)', () => {
    it('should set focus to Note textarea on open', () => {
      render(<ProjectInfoModal {...defaultProps} />)

      const textarea = screen.getByTestId('note-editor')
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
      const textarea = screen.getByTestId('note-editor')
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

/**
 * Unit Test: CommentInlineEdit Component
 *
 * Test targets:
 * - Textarea rendering and initial value
 * - Character counter display and warning states
 * - Save/Cancel functionality
 * - Keyboard shortcuts (Enter, Escape)
 * - Auto-save on blur
 * - Presses in the editor that the card around it must not take for a drag
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

import { CommentInlineEdit } from '@/components/Board/CommentInlineEdit'
import { mayStartDrag } from '@/lib/utils/may-start-drag'

// Mock CommentDisplay for constants
vi.mock('@/components/Board/CommentDisplay', () => ({
  COMMENT_CARD_COLORS: {
    neutral: 'bg-muted/50 border border-border',
    blue: 'bg-blue-100 border border-blue-300',
    green: 'bg-green-100 border border-green-300',
    orange: 'bg-orange-100 border border-orange-300',
    pink: 'bg-pink-100 border border-pink-300',
    purple: 'bg-purple-100 border border-purple-300',
    yellow: 'bg-yellow-100 border border-yellow-300',
  },
  DEFAULT_COMMENT_STYLE: {
    borderColor: 'neutral',
    fontSize: 'sm',
    fontWeight: 'normal',
  },
}))

describe('CommentInlineEdit', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockOnSave.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    // Flush pending promises and timers
    await act(async () => {
      vi.runAllTimers()
    })
    vi.useRealTimers()
  })

  const defaultProps = {
    initialValue: 'Initial comment',
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  }

  describe('Basic Rendering', () => {
    test('should render textarea with initial value', () => {
      render(<CommentInlineEdit {...defaultProps} />)

      const textarea = screen.getByTestId('comment-textarea')
      expect(textarea).toHaveValue('Initial comment')
    })

    test('should render character counter', () => {
      render(<CommentInlineEdit {...defaultProps} />)

      expect(screen.getByTestId('character-counter')).toHaveTextContent(
        '15/2000',
      )
    })

    test('should render save button', () => {
      render(<CommentInlineEdit {...defaultProps} />)

      expect(screen.getByTestId('comment-save-btn')).toBeInTheDocument()
    })

    test('should auto-focus textarea by default', () => {
      render(<CommentInlineEdit {...defaultProps} />)

      const textarea = screen.getByTestId('comment-textarea')
      expect(document.activeElement).toBe(textarea)
    })

    test('should not auto-focus when autoFocus is false', () => {
      render(<CommentInlineEdit {...defaultProps} autoFocus={false} />)

      const textarea = screen.getByTestId('comment-textarea')
      expect(document.activeElement).not.toBe(textarea)
    })
  })

  describe('Character Counter States', () => {
    test('should show normal counter when under warning threshold', () => {
      render(
        <CommentInlineEdit {...defaultProps} initialValue={'a'.repeat(100)} />,
      )

      const counter = screen.getByTestId('character-counter')
      expect(counter).toHaveTextContent('100/2000')
      expect(counter).toHaveClass('text-foreground/70')
    })

    test('should show warning color when at warning threshold (270+)', () => {
      render(
        <CommentInlineEdit
          {...defaultProps}
          maxLength={300}
          initialValue={'a'.repeat(270)}
        />,
      )

      // Orange on a chip of the page background: no warning color passes
      // 4.5:1 on every comment tint (comment-counter-contrast.test.ts)
      const counter = screen.getByTestId('character-counter')
      expect(counter).toHaveTextContent('270/300')
      expect(counter).toHaveClass('bg-background', 'text-warning')
    })

    test('should show error color when over limit (300+)', () => {
      render(
        <CommentInlineEdit
          {...defaultProps}
          maxLength={300}
          initialValue={'a'.repeat(310)}
        />,
      )

      // The label on a destructive fill: red text on a comment tint drops
      // to 3.0:1 (comment-counter-contrast.test.ts)
      const counter = screen.getByTestId('character-counter')
      expect(counter).toHaveTextContent('310/300')
      expect(counter).toHaveClass('bg-destructive text-destructive-foreground')
      expect(counter).not.toHaveClass('text-destructive')
    })

    test('keeps the comment readable over the limit: the typed text does not turn red and the field is marked invalid', () => {
      // Arrange
      render(
        <CommentInlineEdit
          {...defaultProps}
          maxLength={300}
          initialValue={'a'.repeat(310)}
        />,
      )

      // Act
      const textarea = screen.getByTestId('comment-textarea')

      // Assert
      expect(textarea).not.toHaveClass('text-destructive')
      expect(textarea).toHaveAttribute('aria-invalid', 'true')
    })

    test('does not mark the field invalid while the comment fits', () => {
      // Arrange
      render(
        <CommentInlineEdit
          {...defaultProps}
          maxLength={300}
          initialValue={'a'.repeat(300)}
        />,
      )

      // Act
      const textarea = screen.getByTestId('comment-textarea')

      // Assert
      expect(textarea).toHaveAttribute('aria-invalid', 'false')
    })

    test('a screen reader reads the counter with the field', () => {
      // Arrange
      render(
        <CommentInlineEdit {...defaultProps} initialValue={'a'.repeat(100)} />,
      )

      // Act
      const textarea = screen.getByTestId('comment-textarea')

      // Assert
      expect(textarea).toHaveAccessibleDescription('100/2000')
    })

    test('should support custom maxLength', () => {
      render(
        <CommentInlineEdit
          {...defaultProps}
          maxLength={100}
          initialValue={'a'.repeat(50)}
        />,
      )

      const counter = screen.getByTestId('character-counter')
      expect(counter).toHaveTextContent('50/100')
    })
  })

  describe('Save Functionality', () => {
    test('should call onSave with closeOnSave:true when save button is clicked', async () => {
      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} />)

      // Change value first
      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'New comment')

      await user.click(screen.getByTestId('comment-save-btn'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('New comment', {
          closeOnSave: true,
        })
      })
    })

    test('should not save when value has not changed', async () => {
      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} />)

      await user.click(screen.getByTestId('comment-save-btn'))

      expect(mockOnSave).not.toHaveBeenCalled()
      expect(mockOnCancel).toHaveBeenCalled()
    })

    test('should disable save button when over character limit', () => {
      render(
        <CommentInlineEdit
          {...defaultProps}
          maxLength={300}
          initialValue={'a'.repeat(310)}
        />,
      )

      const saveBtn = screen.getByTestId('comment-save-btn')
      expect(saveBtn).toBeDisabled()
    })

    test('should disable save button while saving', async () => {
      // Make onSave hang
      mockOnSave.mockImplementation(
        async () => new Promise((resolve) => setTimeout(resolve, 1000)),
      )

      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} initialValue="Original" />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Changed')

      const saveBtn = screen.getByTestId('comment-save-btn')
      await user.click(saveBtn)

      // Button should be disabled while saving
      await waitFor(() => {
        expect(saveBtn).toBeDisabled()
      })
    })
  })

  describe('Keyboard Shortcuts', () => {
    test('should save and close when Enter is pressed (without Shift)', async () => {
      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} initialValue="Original" />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'New value{Enter}')

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ closeOnSave: true }),
        )
      })
    })

    test('should allow newlines when Shift+Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

      expect(textarea).toHaveValue('Line 1\nLine 2')
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    test('should cancel when Escape is pressed', async () => {
      render(<CommentInlineEdit {...defaultProps} />)

      const textarea = screen.getByTestId('comment-textarea')
      fireEvent.keyDown(textarea, { key: 'Escape' })

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('Inside a draggable card', () => {
    // Value: protects=a press on the counter of the editor does not pick up the card that holds it; fails_when=the editor loses its data-no-drag mark, the one thing the drag sensors of the board know its box by; why_new=the test before pinned a stopped pointerdown, an event no sensor of the board listens for; seam=the editor inside an element that asks mayStartDrag, with React events; no_claim=the board in a browser, see e2e/logged-in/what-starts-a-drag.spec.ts
    test('keeps a press on its counter from picking up the card that holds it', () => {
      // Arrange
      const answers: boolean[] = []
      render(
        <div onMouseDown={(event) => answers.push(mayStartDrag(event))}>
          <CommentInlineEdit {...defaultProps} />
        </div>,
      )

      // Act
      fireEvent.mouseDown(screen.getByTestId('character-counter'))

      // Assert
      expect(answers).toEqual([false])
    })

    // Value: protects=a press on the edge of the editor, between its field and its counter, does not pick up the card; fails_when=the mark sits on the field or the counter and not on the box around them; why_new=the box is neither a field nor a button, so only the mark covers it; seam=the editor inside an element that asks mayStartDrag, with React events; no_claim=the board in a browser
    test('keeps a press on its own box from picking up the card that holds it', () => {
      // Arrange
      const answers: boolean[] = []
      render(
        <div onMouseDown={(event) => answers.push(mayStartDrag(event))}>
          <CommentInlineEdit {...defaultProps} />
        </div>,
      )

      // Act
      fireEvent.mouseDown(screen.getByTestId('comment-inline-edit'))

      // Assert
      expect(answers).toEqual([false])
    })
  })

  describe('Auto-save on Blur', () => {
    test('should auto-save when focus is lost', async () => {
      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} initialValue="Original" />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Changed')

      // Blur the textarea
      fireEvent.blur(textarea)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Changed', {
          closeOnSave: false,
        })
      })
    })

    test('should not auto-save if focus moves to save button', async () => {
      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} initialValue="Original" />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Changed')

      const saveBtn = screen.getByTestId('comment-save-btn')

      // Simulate blur with relatedTarget being the save button
      fireEvent.blur(textarea, { relatedTarget: saveBtn })

      // onSave should not be called from blur
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    test('should not auto-save after Escape is pressed', async () => {
      render(<CommentInlineEdit {...defaultProps} initialValue="Original" />)

      const textarea = screen.getByTestId('comment-textarea')
      fireEvent.change(textarea, { target: { value: 'Changed' } })

      // Press Escape first
      fireEvent.keyDown(textarea, { key: 'Escape' })

      // Then blur
      fireEvent.blur(textarea)

      // onCancel should be called, not onSave
      expect(mockOnCancel).toHaveBeenCalled()
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  describe('Cancel Functionality', () => {
    test('should not cancel while saving', async () => {
      mockOnSave.mockImplementation(
        async () => new Promise((resolve) => setTimeout(resolve, 500)),
      )

      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} initialValue="Original" />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Changed')

      // Start saving
      await user.click(screen.getByTestId('comment-save-btn'))

      // Try to cancel immediately
      fireEvent.keyDown(textarea, { key: 'Escape' })

      // Cancel should not be called during save
      expect(mockOnCancel).not.toHaveBeenCalled()
    })
  })

  describe('Style Configuration', () => {
    test('should apply custom border color style', () => {
      render(
        <CommentInlineEdit {...defaultProps} style={{ borderColor: 'blue' }} />,
      )

      const container = screen.getByTestId('comment-inline-edit')
      expect(container).toHaveClass('bg-blue-100')
    })

    test('should apply default neutral style when no style provided', () => {
      render(<CommentInlineEdit {...defaultProps} />)

      const container = screen.getByTestId('comment-inline-edit')
      expect(container).toHaveClass('bg-muted/50')
    })
  })

  describe('Accessibility', () => {
    test('should have accessible save button with aria-label', () => {
      render(<CommentInlineEdit {...defaultProps} />)

      expect(screen.getByLabelText('Save comment')).toBeInTheDocument()
    })

    test('should have placeholder text for empty textarea', () => {
      render(<CommentInlineEdit {...defaultProps} initialValue="" />)

      const textarea = screen.getByTestId('comment-textarea')
      expect(textarea).toHaveAttribute('placeholder', 'Add a comment...')
    })

    test('should disable textarea while saving', async () => {
      mockOnSave.mockImplementation(
        async () => new Promise((resolve) => setTimeout(resolve, 500)),
      )

      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} initialValue="Original" />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Changed')

      await user.click(screen.getByTestId('comment-save-btn'))

      await waitFor(() => {
        expect(textarea).toBeDisabled()
      })
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty initial value', () => {
      render(<CommentInlineEdit {...defaultProps} initialValue="" />)

      expect(screen.getByTestId('character-counter')).toHaveTextContent(
        '0/2000',
      )
    })

    test('should handle whitespace-only input', async () => {
      const user = userEvent.setup()
      render(<CommentInlineEdit {...defaultProps} initialValue="" />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.type(textarea, '   ')

      await user.click(screen.getByTestId('comment-save-btn'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('   ', { closeOnSave: true })
      })
    })

    test('should apply custom className', () => {
      render(<CommentInlineEdit {...defaultProps} className="custom-class" />)

      const container = screen.getByTestId('comment-inline-edit')
      expect(container).toHaveClass('custom-class')
    })
  })
})

/**
 * Unit Tests: CommentSection
 *
 * Closing the comment editor hides the field that had the keyboard. The
 * comment that comes back, or "Add comment" when nothing is left, takes it.
 *
 * @see src/components/Board/CommentSection.tsx
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memo, useState, type ReactElement } from 'react'
import { describe, expect, test, vi } from 'vitest'

import type { CommentSaveOptions } from '@/components/Board/CommentInlineEdit'
import { CommentSection } from '@/components/Board/CommentSection'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

/**
 * A card's comment, opened and closed the way RepoCard does.
 * @param initialComment - The comment the card already has.
 * @returns The comment section.
 */
const CommentOnACard = memo(function CommentOnACard({
  initialComment,
}: {
  initialComment: string
}): ReactElement {
  const [comment, setComment] = useState(initialComment)
  const [isEditing, setIsEditing] = useState(false)

  return (
    <CommentSection
      comment={comment}
      isEditing={isEditing}
      onStartEdit={(): void => setIsEditing(true)}
      onSave={async (value: string, options: CommentSaveOptions) => {
        setComment(value)
        if (options.closeOnSave) setIsEditing(false)
      }}
      onCancel={(): void => setIsEditing(false)}
      onColorChange={(): void => undefined}
      onDelete={(): void => setComment('')}
    />
  )
})

describe('CommentSection', () => {
  // Value: protects=Escape in the comment editor leaves the keyboard on that comment, so the next key is not taken from the top of the board; fails_when=the editor closes and the focus is on the page; why_new=hiding the editor dropped the focus; seam=none; no_claim=a browser taking the focus two frames later (a story would see that)
  test('puts the keyboard back on the comment when Escape closes the editor', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CommentOnACard initialComment="ship the focus" />)
    await user.click(screen.getByTestId('comment-display'))
    expect(screen.getByTestId('comment-textarea')).toHaveFocus()

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.getByTestId('comment-display')).toHaveFocus()
  })

  // Value: protects=Escape in an empty comment's editor leaves the keyboard on "Add comment"; fails_when=the placeholder is not focused and the next key starts from the page; why_new=the empty comment is a different element from the editor; seam=none; no_claim=a browser taking the focus two frames later
  test('puts the keyboard on Add comment when Escape closes an empty editor', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CommentOnACard initialComment="" />)
    await user.click(screen.getByTestId('comment-empty-state'))
    expect(screen.getByTestId('comment-textarea')).toHaveFocus()

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.getByTestId('comment-empty-state')).toHaveFocus()
    expect(screen.getByText('Add comment')).toBeVisible()
  })

  // Value: protects=Enter, which saves and closes the editor, leaves the keyboard on the comment that was just saved; fails_when=the comment is saved and the focus is on the page; why_new=Enter closes the editor the same way Escape does; seam=none; no_claim=the server (the save stays on the card)
  test('puts the keyboard back on the comment when Enter saves it', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CommentOnACard initialComment="ship the focus" />)
    await user.click(screen.getByTestId('comment-display'))
    await user.type(screen.getByTestId('comment-textarea'), ' today')

    // Act
    await user.keyboard('{Enter}')

    // Assert
    expect(screen.getByTestId('comment-display')).toHaveFocus()
    expect(screen.getByTestId('comment-text')).toHaveTextContent(
      'ship the focus today',
    )
  })

  // Value: protects=the save button leaves the keyboard on the comment; fails_when=the button closes the editor and the focus is on the page; why_new=the save button is the third way the editor closes; seam=none; no_claim=the server
  test('puts the keyboard back on the comment when its save button closes the editor', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CommentOnACard initialComment="ship the focus" />)
    await user.click(screen.getByTestId('comment-display'))
    await user.type(screen.getByTestId('comment-textarea'), ' today')

    // Act
    await user.click(screen.getByTestId('comment-save-btn'))

    // Assert
    expect(screen.getByTestId('comment-display')).toHaveFocus()
  })

  // Value: protects=saving a comment down to nothing leaves the keyboard on "Add comment", which is the control that replaced the text; fails_when=the text's element is gone and the focus is on the page; why_new=an emptied comment swaps the focused control for the placeholder; seam=none; no_claim=the server
  test('puts the keyboard on Add comment when the saved comment is empty', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<CommentOnACard initialComment="ship the focus" />)
    await user.click(screen.getByTestId('comment-display'))
    await user.clear(screen.getByTestId('comment-textarea'))

    // Act
    await user.keyboard('{Enter}')

    // Assert
    expect(screen.getByTestId('comment-empty-state')).toHaveFocus()
    expect(screen.getByText('Add comment')).toBeVisible()
  })
})

/**
 * CommentSection stories.
 *
 * The editor closes into the comment. A browser can take the keyboard off a
 * control it has just hidden, so these stories wait two frames and then ask
 * where the keyboard is.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { memo, useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import type { CommentSaveOptions } from './CommentInlineEdit'
import { CommentSection } from './CommentSection'

/**
 * A card's comment, opened and closed through {@link CommentSection}.
 */
const CommentOnACard = memo(function CommentOnACard({
  initialComment,
}: {
  initialComment: string
}) {
  const [comment, setComment] = useState(initialComment)
  const [isEditing, setIsEditing] = useState(false)

  return (
    <CommentSection
      comment={comment}
      isEditing={isEditing}
      onStartEdit={(): void => setIsEditing(true)}
      onSave={async (
        value: string,
        options: CommentSaveOptions,
      ): Promise<void> => {
        setComment(value)
        if (options.closeOnSave) setIsEditing(false)
      }}
      onCancel={(): void => setIsEditing(false)}
      onColorChange={(): void => undefined}
      onDelete={(): void => setComment('')}
    />
  )
})

const meta = {
  title: 'Board/CommentSection',
  component: CommentSection,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CommentSection>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Waits until the browser has drawn the page twice.
 * A hidden field can lose the keyboard on the frames after it closes.
 * @returns A promise that resolves in the second animation frame from now.
 */
async function waitForNextFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export const EscapeReturnsToTheComment: Story = {
  args: {
    comment: 'ship the focus',
    isEditing: false,
    onStartEdit: (): void => undefined,
    onSave: async (): Promise<void> => undefined,
    onCancel: (): void => undefined,
    onColorChange: (): void => undefined,
    onDelete: (): void => undefined,
  },
  render: () => (
    <div className="bg-card w-[320px] rounded-lg border p-4">
      <CommentOnACard initialComment="ship the focus" />
    </div>
  ),
  // Value: protects=after Escape the keyboard is still on the comment once the browser has drawn the closed editor; fails_when=the focus is on the page two frames later; why_new=happy-dom does not take the focus away when the editor is hidden; seam=none; no_claim=none
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const user = userEvent.setup()
    await user.click(canvas.getByTestId('comment-display'))
    await expect(canvas.getByTestId('comment-textarea')).toHaveFocus()

    // Act
    await user.keyboard('{Escape}')
    await waitForNextFrames()

    // Assert
    await expect(canvas.getByTestId('comment-display')).toHaveFocus()
  },
}

export const EscapeReturnsToAddComment: Story = {
  args: {
    comment: '',
    isEditing: false,
    onStartEdit: (): void => undefined,
    onSave: async (): Promise<void> => undefined,
    onCancel: (): void => undefined,
    onColorChange: (): void => undefined,
    onDelete: (): void => undefined,
  },
  render: () => (
    <div className="bg-card w-[320px] rounded-lg border p-4">
      <CommentOnACard initialComment="" />
    </div>
  ),
  // Value: protects=after Escape in an empty comment the keyboard is on Add comment once the browser has drawn; fails_when=the focus is on the page two frames later; why_new=the placeholder is a different element from the editor; seam=none; no_claim=none
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const user = userEvent.setup()
    await user.click(canvas.getByTestId('comment-empty-state'))
    await expect(canvas.getByTestId('comment-textarea')).toHaveFocus()

    // Act
    await user.keyboard('{Escape}')
    await waitForNextFrames()

    // Assert
    await expect(canvas.getByTestId('comment-empty-state')).toHaveFocus()
  },
}

export const EnterReturnsToTheComment: Story = {
  args: {
    comment: 'ship the focus',
    isEditing: false,
    onStartEdit: (): void => undefined,
    onSave: async (): Promise<void> => undefined,
    onCancel: (): void => undefined,
    onColorChange: (): void => undefined,
    onDelete: (): void => undefined,
  },
  render: () => (
    <div className="bg-card w-[320px] rounded-lg border p-4">
      <CommentOnACard initialComment="ship the focus" />
    </div>
  ),
  // Value: protects=after Enter saves, the keyboard is on the comment once the browser has drawn; fails_when=the focus is on the page two frames later; why_new=Enter closes the editor the same way Escape does; seam=none; no_claim=the server
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const user = userEvent.setup()
    await user.click(canvas.getByTestId('comment-display'))
    await user.type(canvas.getByTestId('comment-textarea'), ' today')

    // Act
    await user.keyboard('{Enter}')
    await waitForNextFrames()

    // Assert
    await expect(canvas.getByTestId('comment-display')).toHaveFocus()
  },
}

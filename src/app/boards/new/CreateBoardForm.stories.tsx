/**
 * CreateBoardForm Component Stories
 *
 * The form of /boards/new: a board name with its length check and a column
 * preset.
 *
 * `pnpm test` runs these stories in a real browser, which is where the focus
 * of a disabled field can be checked: a browser takes the focus away from a
 * field that is disabled, happy-dom leaves it there. The other interaction
 * tests are in src/tests/unit/app/boards/CreateBoardForm.test.tsx.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, mocked, userEvent, within } from 'storybook/test'

import { createBoard } from '@/lib/actions/board'

import { CreateBoardForm } from './CreateBoardForm'

const meta = {
  title: 'Boards/CreateBoardForm',
  component: CreateBoardForm,
  parameters: {
    layout: 'centered',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background w-200 rounded-lg border p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateBoardForm>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default form state showing name input and theme selection
 */
export const Default: Story = {}

/**
 * The server refused a creation that was sent with Enter. The name field was
 * disabled while the request ran, so the browser took the focus away from it.
 * The form gives it back: the name can be changed or sent again from the
 * keyboard.
 */
export const FocusReturnsToNameAfterRefusal: Story = {
  beforeEach: () => {
    // The answer comes after the browser has drawn the disabled form, as a
    // server's does. That is when a browser takes the focus away: a field
    // that is disabled and enabled again before the next frame keeps it.
    mocked(createBoard).mockImplementation(async () => {
      await waitForNextFrames()
      return { success: false, error: 'The board was not created. Try again.' }
    })
  },
  // Value: protects=after a refused creation that was sent with Enter the keyboard is in the name field again; fails_when=the form gives the focus back only when one of its buttons lost it, or not at all; why_new=the unit test sends with the button, and happy-dom leaves the focus on a disabled field, so it cannot show this path; seam=none; no_claim=none
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const nameField = canvas.getByLabelText('Board Name')

    // Act: sent from the field itself, which is disabled while the request runs
    await userEvent.type(nameField, 'Side Projects{Enter}')

    // Assert
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'The board was not created. Try again.',
    )
    await expect(nameField).toHaveFocus()
    await expect(nameField).toHaveValue('Side Projects')
  },
}

/**
 * Waits until the browser has drawn the page twice.
 * Exists for stories whose mocked server has to answer after a frame, called
 * from their `beforeEach`.
 * @returns A promise that resolves in the second animation frame from now.
 * @example
 * await waitForNextFrames() // the disabled form is on the screen by now
 */
async function waitForNextFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

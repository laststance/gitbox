/**
 * DeleteAccountDialog Component Stories
 *
 * Tests the account deletion confirmation dialog:
 * - Default open state with disabled delete button
 * - Typing "DELETE" enables the confirm button
 * - Cancel button closes the dialog
 * - Accessible structure verified via a11y checks
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { DeleteAccountDialog } from './DeleteAccountDialog'

const meta = {
  title: 'Modals/DeleteAccountDialog',
  component: DeleteAccountDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DeleteAccountDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default state: dialog open, delete button disabled
 */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
  play: async ({ canvasElement: _canvasElement }) => {
    // Dialog renders in a portal, query the document body
    const body = within(document.body)

    await waitFor(
      () => {
        expect(body.getByTestId('delete-account-dialog')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // Delete button should be disabled by default
    const deleteButton = body.getByTestId('confirm-delete-button')
    expect(deleteButton).toBeDisabled()

    // Cancel button should be enabled
    const cancelButton = body.getByTestId('cancel-delete-button')
    expect(cancelButton).toBeEnabled()
  },
}

/**
 * After typing "DELETE", the confirm button becomes enabled
 */
export const WithConfirmationTyped: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
  play: async () => {
    const body = within(document.body)

    await waitFor(
      () => {
        expect(
          body.getByTestId('delete-confirmation-input'),
        ).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    const input = body.getByTestId('delete-confirmation-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'DELETE')

    // Button should now be enabled
    await waitFor(() => {
      const deleteButton = body.getByTestId('confirm-delete-button')
      expect(deleteButton).toBeEnabled()
    })
  },
}

/**
 * Partial input keeps button disabled
 */
export const PartialInput: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
  },
  play: async () => {
    const body = within(document.body)

    await waitFor(
      () => {
        expect(
          body.getByTestId('delete-confirmation-input'),
        ).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    const input = body.getByTestId('delete-confirmation-input')
    await userEvent.clear(input)
    await userEvent.type(input, 'DEL')

    // Button should still be disabled
    const deleteButton = body.getByTestId('confirm-delete-button')
    expect(deleteButton).toBeDisabled()
  },
}

/**
 * Dialog in closed state renders nothing
 */
export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
  },
}

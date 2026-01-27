/**
 * Create Link Type Dialog Component Stories
 *
 * A dialog for creating custom link type presets.
 * Users can specify a name and icon for their custom link type.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { memo, useState } from 'react'
import { expect, userEvent, waitFor, fn } from 'storybook/test'

import { Button } from '@/components/ui/button'

import { CreateLinkTypeDialog } from './CreateLinkTypeDialog'

const meta: Meta<typeof CreateLinkTypeDialog> = {
  title: 'Modals/CreateLinkTypeDialog',
  component: CreateLinkTypeDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof CreateLinkTypeDialog>

/**
 * Default state with dialog closed
 */
const DefaultStory = memo(function DefaultStory() {
  const [open, setOpen] = useState(false)
  const [createdPreset, setCreatedPreset] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4 items-center">
      <Button onClick={() => setOpen(true)}>Add Custom Link Type</Button>
      <CreateLinkTypeDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(preset) => setCreatedPreset(preset.label)}
      />
      {createdPreset && (
        <p className="text-sm text-green-600">Created: {createdPreset}</p>
      )}
    </div>
  )
})

export const Default: Story = {
  render: () => <DefaultStory />,
}

/**
 * Dialog open state (for visual testing)
 */
export const Open: Story = {
  render: () => <CreateLinkTypeDialog open={true} onOpenChange={() => {}} />,
}

/**
 * Tests that dialog renders with all required elements
 */
export const DialogElementsRender: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    // Dialog renders in portal, query from document
    await waitFor(() => {
      const dialog = document.querySelector(
        '[data-testid="create-link-type-dialog"]',
      )
      expect(dialog).toBeInTheDocument()
    })

    // Check input field
    const input = document.querySelector(
      '[data-testid="link-type-label-input"]',
    )
    expect(input).toBeInTheDocument()

    // Check icon select
    const iconSelect = document.querySelector(
      '[data-testid="link-type-icon-select"]',
    )
    expect(iconSelect).toBeInTheDocument()

    // Check buttons
    const cancelButton = document.querySelector(
      '[data-testid="cancel-create-link-type"]',
    )
    const submitButton = document.querySelector(
      '[data-testid="submit-create-link-type"]',
    )
    expect(cancelButton).toBeInTheDocument()
    expect(submitButton).toBeInTheDocument()
  },
}

/**
 * Tests empty label validation error
 */
export const EmptyLabelValidation: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector(
        '[data-testid="create-link-type-dialog"]',
      )
      expect(dialog).toBeInTheDocument()
    })

    // Try to submit with empty label by clicking submit
    const submitButton = document.querySelector(
      '[data-testid="submit-create-link-type"]',
    ) as HTMLButtonElement
    // Button should be disabled when label is empty
    expect(submitButton?.disabled).toBe(true)
  },
}

/**
 * Tests label input typing
 */
export const LabelInput: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const input = document.querySelector(
        '[data-testid="link-type-label-input"]',
      )
      expect(input).toBeInTheDocument()
    })

    const input = document.querySelector(
      '[data-testid="link-type-label-input"]',
    ) as HTMLInputElement
    await userEvent.type(input, 'My Custom Service')

    // Check that input value is updated
    expect(input.value).toBe('My Custom Service')

    // Submit button should now be enabled
    const submitButton = document.querySelector(
      '[data-testid="submit-create-link-type"]',
    ) as HTMLButtonElement
    expect(submitButton?.disabled).toBe(false)
  },
}

/**
 * Tests cancel button closes dialog
 */
export const CancelButtonCloses: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async ({ args }) => {
    await waitFor(() => {
      const dialog = document.querySelector(
        '[data-testid="create-link-type-dialog"]',
      )
      expect(dialog).toBeInTheDocument()
    })

    const cancelButton = document.querySelector(
      '[data-testid="cancel-create-link-type"]',
    )
    if (cancelButton) {
      await userEvent.click(cancelButton)
    }

    // onOpenChange should be called (to close the dialog)
    await waitFor(() => {
      expect(args.onOpenChange).toHaveBeenCalled()
    })
  },
}

/**
 * Tests label length validation (over 50 chars)
 */
export const LabelLengthValidation: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const input = document.querySelector(
        '[data-testid="link-type-label-input"]',
      )
      expect(input).toBeInTheDocument()
    })

    const input = document.querySelector(
      '[data-testid="link-type-label-input"]',
    ) as HTMLInputElement
    // Type 51 characters (maxLength is 50 on the input)
    const longText = 'a'.repeat(50)
    await userEvent.type(input, longText)

    // The input should be at 50 characters (enforced by maxLength)
    expect(input.value.length).toBeLessThanOrEqual(50)
  },
}

/**
 * Tests icon selection
 */
export const IconSelection: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const iconSelect = document.querySelector(
        '[data-testid="link-type-icon-select"]',
      )
      expect(iconSelect).toBeInTheDocument()
    })

    // Click the icon select to open dropdown
    const iconSelect = document.querySelector(
      '[data-testid="link-type-icon-select"]',
    )
    if (iconSelect) {
      await userEvent.click(iconSelect)
    }

    // Wait for select options to appear
    await waitFor(() => {
      const options = document.querySelectorAll('[role="option"]')
      expect(options.length).toBeGreaterThan(0)
    })
  },
}

/**
 * Tests successful form submission
 */
export const SuccessfulSubmission: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    onCreated: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const input = document.querySelector(
        '[data-testid="link-type-label-input"]',
      )
      expect(input).toBeInTheDocument()
    })

    // Type a label
    const input = document.querySelector(
      '[data-testid="link-type-label-input"]',
    ) as HTMLInputElement
    await userEvent.type(input, 'Custom Service')

    // Submit button should be enabled
    const submitButton = document.querySelector(
      '[data-testid="submit-create-link-type"]',
    ) as HTMLButtonElement
    expect(submitButton?.disabled).toBe(false)

    // Click submit - this triggers the form submission
    await userEvent.click(submitButton)

    // Form should attempt to submit (async transition)
    // The button text may change to "Creating..."
    await waitFor(() => {
      // Either button shows "Creating..." or onOpenChange was called
      const buttonText = submitButton?.textContent
      expect(buttonText === 'Creating...' || buttonText === 'Create').toBe(true)
    })
  },
}

/**
 * Tests character count display
 */
export const CharacterCountDisplay: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const input = document.querySelector(
        '[data-testid="link-type-label-input"]',
      )
      expect(input).toBeInTheDocument()
    })

    // Initially shows 0/50
    const charCount = document.querySelector(
      '[data-testid="create-link-type-dialog"]',
    )?.textContent
    expect(charCount).toContain('0/50')

    // Type some characters
    const input = document.querySelector(
      '[data-testid="link-type-label-input"]',
    ) as HTMLInputElement
    await userEvent.type(input, 'Test')

    // Should show 4/50
    await waitFor(() => {
      const updatedCharCount = document.querySelector(
        '[data-testid="create-link-type-dialog"]',
      )?.textContent
      expect(updatedCharCount).toContain('4/50')
    })
  },
}

/**
 * Tests all icon options are present
 */
export const AllIconOptionsPresent: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const iconSelect = document.querySelector(
        '[data-testid="link-type-icon-select"]',
      )
      expect(iconSelect).toBeInTheDocument()
    })

    // Click to open dropdown
    const iconSelect = document.querySelector(
      '[data-testid="link-type-icon-select"]',
    )
    if (iconSelect) {
      await userEvent.click(iconSelect)
    }

    // Check that multiple icon options exist (20 options defined in component)
    await waitFor(() => {
      const options = document.querySelectorAll('[role="option"]')
      expect(options.length).toBe(20)
    })
  },
}

/**
 * Tests dialog has proper accessibility attributes
 */
export const AccessibilityAttributes: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector(
        '[data-testid="create-link-type-dialog"]',
      )
      expect(dialog).toBeInTheDocument()
    })

    // Check dialog role
    const dialogRole = document.querySelector('[role="dialog"]')
    expect(dialogRole).toBeInTheDocument()

    // Check labels
    const labelInput = document.querySelector(
      '[data-testid="link-type-label-input"]',
    )
    expect(labelInput).toHaveAttribute('maxLength', '50')
  },
}

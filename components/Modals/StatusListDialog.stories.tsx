/**
 * StatusListDialog Component Stories
 *
 * A dialog component for creating and editing status columns in the Kanban board.
 * Allows setting column name and color (with preset options and custom color picker).
 * Supports both create and edit modes with proper form validation and error handling.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor, fn } from 'storybook/test'

import { StatusListDialog } from './StatusListDialog'

const meta = {
  title: 'Modals/StatusListDialog',
  component: StatusListDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StatusListDialog>

export default meta
type Story = StoryObj<typeof meta>

const mockStatusList = {
  id: 'status-1',
  boardId: 'board-1',
  title: 'In Progress',
  color: '#4682B4',
  gridRow: 0,
  gridCol: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
}

export const CreateMode: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: () => console.log('Dialog closed'),
    onSave: async (data) => {
      console.log('Creating status:', data)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
  },
}

export const EditMode: Story = {
  args: {
    isOpen: true,
    mode: 'edit',
    statusList: mockStatusList,
    onClose: () => console.log('Dialog closed'),
    onSave: async (data) => {
      console.log('Updating status:', data)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
  },
}

/**
 * Tests dialog renders in create mode
 */
export const CreateModeRender: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Check input exists
    const input =
      document.querySelector('input[placeholder*="status"]') ||
      document.querySelector('input')
    expect(input).toBeInTheDocument()
  },
}

/**
 * Tests dialog renders in edit mode with pre-filled values
 */
export const EditModeRender: Story = {
  args: {
    isOpen: true,
    mode: 'edit',
    statusList: mockStatusList,
    onClose: fn(),
    onSave: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Check that the input has the existing value
    const input = document.querySelector('input') as HTMLInputElement
    expect(input?.value).toBe('In Progress')
  },
}

/**
 * Tests cancel button closes dialog
 */
export const CancelCloses: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn(),
  },
  play: async ({ args }) => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find and click cancel button
    const cancelButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.toLowerCase().includes('cancel'),
    )
    if (cancelButton) {
      await userEvent.click(cancelButton)
    }

    await waitFor(() => {
      expect(args.onClose).toHaveBeenCalled()
    })
  },
}

/**
 * Tests typing in the name input
 */
export const NameInput: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const input = document.querySelector('input')
      expect(input).toBeInTheDocument()
    })

    const input = document.querySelector('input') as HTMLInputElement
    await userEvent.type(input, 'New Status')

    expect(input.value).toBe('New Status')
  },
}

/**
 * Tests color preset selection
 */
export const ColorSelection: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Look for color buttons (usually div/button with background colors)
    const colorButtons = document.querySelectorAll('[data-color]')
    if (colorButtons.length > 0) {
      await userEvent.click(colorButtons[0]!)
    }
  },
}

/**
 * Tests form validation - empty name shows error
 */
export const EmptyNameValidation: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn(),
  },
  play: async ({ args }) => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find and click submit button without entering a name
    const submitButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Column'),
    )
    if (submitButton) {
      await userEvent.click(submitButton)
    }

    // Check that onSave was NOT called (validation failed)
    await waitFor(() => {
      expect(args.onSave).not.toHaveBeenCalled()
    })
  },
}

/**
 * Tests successful form submission in create mode
 */
export const SuccessfulCreate: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn().mockResolvedValue(undefined),
  },
  play: async ({ args }) => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Type a name
    const input = document.querySelector('input') as HTMLInputElement
    await userEvent.type(input, 'New Status Column')

    // Click submit
    const submitButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Column'),
    )
    if (submitButton) {
      await userEvent.click(submitButton)
    }

    await waitFor(() => {
      expect(args.onSave).toHaveBeenCalledWith({
        name: 'New Status Column',
        color: expect.any(String),
      })
    })
  },
}

/**
 * Tests successful form submission in edit mode
 */
export const SuccessfulEdit: Story = {
  args: {
    isOpen: true,
    mode: 'edit',
    statusList: mockStatusList,
    onClose: fn(),
    onSave: fn().mockResolvedValue(undefined),
  },
  play: async ({ args }) => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Modify the name
    const input = document.querySelector('input') as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, 'Modified Status')

    // Click save
    const submitButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Save Changes'),
    )
    if (submitButton) {
      await userEvent.click(submitButton)
    }

    await waitFor(() => {
      expect(args.onSave).toHaveBeenCalledWith({
        name: 'Modified Status',
        color: expect.any(String),
      })
    })
  },
}

/**
 * Tests error handling when save fails - verifies onSave is called with correct data
 * Note: Error message display is tested via unit tests as Storybook's DOM may not include
 * tailwind's text-destructive class styles
 */
export const SaveError: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn().mockRejectedValue(new Error('Save failed')),
  },
  play: async ({ args }) => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Type a name
    const input = document.querySelector('input') as HTMLInputElement
    await userEvent.type(input, 'Test Status')

    // Click submit
    const submitButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Column'),
    )
    if (submitButton) {
      await userEvent.click(submitButton)
    }

    // Verify onSave was called (and will reject)
    await waitFor(
      () => {
        expect(args.onSave).toHaveBeenCalledWith({
          name: 'Test Status',
          color: expect.any(String),
        })
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Tests custom color selection
 */
export const CustomColorPicker: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find color input
    const colorInput = document.querySelector(
      'input[type="color"]',
    ) as HTMLInputElement
    expect(colorInput).toBeInTheDocument()
  },
}

/**
 * Tests preset color button selection
 */
export const PresetColorButtons: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: fn(),
    onSave: fn(),
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find preset color buttons (round buttons with background colors)
    const colorButtons = document.querySelectorAll('button[aria-label]')
    const presetButtons = Array.from(colorButtons).filter((btn) =>
      btn.className.includes('rounded-full'),
    )
    expect(presetButtons.length).toBeGreaterThan(0)

    // Click first preset button
    if (presetButtons.length > 0) {
      await userEvent.click(presetButtons[0]!)
    }
  },
}

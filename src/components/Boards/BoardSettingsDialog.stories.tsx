/**
 * BoardSettingsDialog Component Stories
 *
 * A tabbed dialog for managing board settings including:
 * - General: Rename board functionality
 * - Cards: Card display settings
 * - Danger Zone: Delete board with confirmation
 *
 * Note: Theme is now managed globally via Sidebar ThemeToggle.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor, fn } from 'storybook/test'

import { BoardSettingsDialog } from './BoardSettingsDialog'

const meta = {
  title: 'Boards/BoardSettingsDialog',
  component: BoardSettingsDialog,
  parameters: {
    layout: 'centered',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
    boardId: 'board-123',
    boardName: 'My Project Board',
  },
} satisfies Meta<typeof BoardSettingsDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default open state on General tab.
 * Shows the rename board form with current name pre-filled.
 */
export const Default: Story = {}

/**
 * Dialog with long board name.
 * Tests character counter near limit.
 */
export const LongBoardName: Story = {
  args: {
    boardName: 'This Is An Extremely Long Board Name That Approaches The Limit',
  },
}

/**
 * Dialog with short board name.
 */
export const ShortBoardName: Story = {
  args: {
    boardName: 'Tasks',
  },
}

/**
 * Dialog in closed state.
 * Verifies the dialog properly hides when isOpen is false.
 */
export const Closed: Story = {
  args: {
    isOpen: false,
  },
}

/**
 * Dialog with special characters in board name.
 * Tests proper handling and display of special characters.
 */
export const SpecialCharacters: Story = {
  args: {
    boardName: 'Project <Alpha> & "Beta"',
  },
}

/**
 * Tests General tab displays correctly
 */
export const GeneralTabRender: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    boardName: 'Test Board',
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Should have General tab content
    expect(document.body).toHaveTextContent('Rename')
  },
}

/**
 * Tests tab switching to Cards tab
 */
export const CardsTabNavigation: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    boardName: 'Test Board',
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find and click Cards tab
    const cardsTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (tab) => tab.textContent?.includes('Cards'),
    )
    if (cardsTab) {
      await userEvent.click(cardsTab)
    }

    // Wait for Cards tab content
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Card Visibility')
    })
  },
}

/**
 * Tests tab switching to Danger Zone
 */
export const DangerZoneTabNavigation: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    boardName: 'Test Board',
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find and click Danger Zone tab
    const dangerTab = Array.from(
      document.querySelectorAll('[role="tab"]'),
    ).find((tab) => tab.textContent?.includes('Danger'))
    if (dangerTab) {
      await userEvent.click(dangerTab)
    }

    // Wait for Danger Zone tab content
    await waitFor(() => {
      expect(document.body).toHaveTextContent('Delete Board')
    })
  },
}

/**
 * Tests rename input typing
 */
export const RenameInputTyping: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    boardName: 'Old Name',
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const input = document.querySelector('input[name="name"]')
      expect(input).toBeInTheDocument()
    })

    // Clear and type new name
    const input = document.querySelector(
      'input[name="name"]',
    ) as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, 'New Board Name')

    // Verify input value
    expect(input.value).toBe('New Board Name')
  },
}

/**
 * Tests card display toggle interactions
 */
export const CardDisplayToggles: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    boardName: 'Test Board',
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Click Cards tab
    const cardsTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (tab) => tab.textContent?.includes('Cards'),
    )
    if (cardsTab) {
      await userEvent.click(cardsTab)
    }

    // Wait for Cards tab content with switches
    await waitFor(() => {
      const switches = document.querySelectorAll('[role="switch"]')
      expect(switches.length).toBeGreaterThan(0)
    })
  },
}

/**
 * Tests close button
 */
export const CloseButton: Story = {
  args: {
    isOpen: true,
    boardId: 'board-123',
    boardName: 'Test Board',
    onClose: fn(),
    onRenameSuccess: fn(),
    onCardDisplayChange: fn(),
    onDeleteSuccess: fn(),
  },
  play: async () => {
    // Wait for dialog to render
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find and click close button
    const closeButton = document.querySelector('button[aria-label="Close"]')
    if (closeButton) {
      await userEvent.click(closeButton)
    }
  },
}

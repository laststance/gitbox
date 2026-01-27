/**
 * ShortcutsHelp Component Stories
 *
 * A modal dialog component displaying keyboard shortcuts help.
 * Accessible via the ? key and provides categorized shortcuts for navigation,
 * actions, and help. Features proper keyboard navigation, focus management,
 * and WCAG AA accessibility compliance.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor } from 'storybook/test'

import { ShortcutsHelp } from './ShortcutsHelp'

const meta = {
  title: 'Components/ShortcutsHelp',
  component: ShortcutsHelp,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ShortcutsHelp>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    defaultOpen: false,
  },
}

export const Opened: Story = {
  args: {
    defaultOpen: true,
  },
}

/**
 * Tests dialog renders when opened
 */
export const DialogRendersWhenOpened: Story = {
  args: {
    defaultOpen: true,
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Should have title
    expect(document.body).toHaveTextContent('Keyboard Shortcuts')
  },
}

/**
 * Tests shortcuts content is displayed
 */
export const ShortcutsContentDisplayed: Story = {
  args: {
    defaultOpen: true,
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Check for some common shortcut keys
    await waitFor(() => {
      // Open command palette shortcut
      expect(document.body).toHaveTextContent('Open command palette')
    })
  },
}

/**
 * Tests dialog can be closed
 */
export const DialogCanBeClosed: Story = {
  args: {
    defaultOpen: true,
  },
  play: async () => {
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find close button
    const closeButton = document.querySelector('[role="dialog"] button')
    if (closeButton) {
      await userEvent.click(closeButton)
    }

    // Dialog should close
    await waitFor(
      () => {
        const dialog = document.querySelector('[role="dialog"]')
        expect(dialog).not.toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}

/**
 * Tests component renders nothing when closed (controlled by keyboard)
 */
export const HiddenWhenClosed: Story = {
  args: {
    defaultOpen: false,
  },
  play: async () => {
    // When closed, no dialog should be visible
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).not.toBeInTheDocument()
    })
  },
}

/**
 * Tests keyboard shortcut (?) opens dialog
 */
export const KeyboardOpensDialog: Story = {
  args: {
    defaultOpen: false,
  },
  play: async () => {
    // Initially no dialog
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).not.toBeInTheDocument()
    })

    // Press ? key to open
    await userEvent.keyboard('?')

    // Dialog should open
    await waitFor(
      () => {
        const dialog = document.querySelector('[role="dialog"]')
        expect(dialog).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

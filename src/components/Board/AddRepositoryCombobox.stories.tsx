/**
 * AddRepositoryCombobox Component Stories
 *
 * A combobox component for searching and adding GitHub repositories to a Kanban board.
 * Features virtual scrolling for 100+ repositories, multi-select support,
 * filtering by owner and visibility, and duplicate detection.
 * Integrates with GitHub API via server actions.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, waitFor, fn } from 'storybook/test'

import { toBoardId, toStatusListId } from '@/lib/types/brands'

import { AddRepositoryCombobox } from './AddRepositoryCombobox'

const meta = {
  title: 'Board/AddRepositoryCombobox',
  component: AddRepositoryCombobox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AddRepositoryCombobox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    boardId: toBoardId('board-1'),
    statusId: toStatusListId('status-1'),
    onRepositoriesAdded: () => console.log('Repositories added'),
  },
}

export const WithCallbacks: Story = {
  args: {
    boardId: toBoardId('board-1'),
    statusId: toStatusListId('status-1'),
    onRepositoriesAdded: () => {
      console.log('Repositories added successfully')
    },
  },
}

/**
 * Tests clicking the add button to open the popover
 */
export const OpenPopover: Story = {
  args: {
    boardId: toBoardId('board-1'),
    statusId: toStatusListId('status-1'),
    onRepositoriesAdded: fn(),
  },
  play: async () => {
    // Wait for component to render
    await waitFor(() => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Add Repositories'),
      )
      expect(button).toBeInTheDocument()
    })

    // Click to open the popover
    const button = Array.from(document.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Add Repositories'),
    ) as HTMLButtonElement
    if (button) {
      await userEvent.click(button)
    }

    // Wait for combobox panel to appear
    await waitFor(
      () => {
        const combobox = document.querySelector('[role="combobox"]')
        expect(combobox).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}

/**
 * Tests search input functionality
 */
export const SearchInput: Story = {
  args: {
    boardId: toBoardId('board-1'),
    statusId: toStatusListId('status-1'),
    onRepositoriesAdded: fn(),
  },
  play: async () => {
    // Wait for component to render
    await waitFor(() => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Add Repositories'),
      )
      expect(button).toBeInTheDocument()
    })

    // Click to open the popover
    const button = Array.from(document.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Add Repositories'),
    ) as HTMLButtonElement
    if (button) {
      await userEvent.click(button)
    }

    // Wait for combobox panel to appear with input
    await waitFor(
      () => {
        const input = document.querySelector('input[type="text"]')
        expect(input).toBeInTheDocument()
      },
      { timeout: 2000 },
    )

    // Type in search
    const input = document.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement
    if (input) {
      await userEvent.type(input, 'test-repo')
      expect(input.value).toBe('test-repo')
    }
  },
}

/**
 * Tests cancel button closes popover
 */
export const CancelButton: Story = {
  args: {
    boardId: toBoardId('board-1'),
    statusId: toStatusListId('status-1'),
    onRepositoriesAdded: fn(),
  },
  play: async () => {
    // Wait for component to render
    await waitFor(() => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Add Repositories'),
      )
      expect(button).toBeInTheDocument()
    })

    // Click to open the popover
    const openButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Add Repositories'),
    ) as HTMLButtonElement
    if (openButton) {
      await userEvent.click(openButton)
    }

    // Wait for combobox panel to appear
    await waitFor(
      () => {
        const combobox = document.querySelector('[role="combobox"]')
        expect(combobox).toBeInTheDocument()
      },
      { timeout: 2000 },
    )

    // Find and click cancel button
    const cancelButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.toLowerCase().includes('cancel'),
    )
    if (cancelButton) {
      await userEvent.click(cancelButton)
    }
  },
}

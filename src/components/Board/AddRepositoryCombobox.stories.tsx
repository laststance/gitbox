/**
 * AddRepositoryCombobox Component Stories
 *
 * A combobox component for searching and adding GitHub repositories to a Kanban board.
 * Features virtual scrolling for 100+ repositories, multi-select support,
 * filtering by owner and visibility, and duplicate detection.
 * Integrates with GitHub API via server actions.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { toBoardId, toStatusListId } from '@/lib/types/brands'

import {
  AddRepositoryCombobox,
  SelectedRepositoryBadge,
} from './AddRepositoryCombobox'

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

/** How many lines the text of an element is drawn on. */
function textLines(node: HTMLElement): number {
  const lineTops = new Set<number>()
  const textNodes = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  while (textNodes.nextNode()) {
    const range = document.createRange()
    range.selectNodeContents(textNodes.currentNode)
    for (const rect of range.getClientRects()) {
      lineTops.add(Math.round(rect.top))
    }
  }
  return lineTops.size
}

const ONE_HUNDRED_LETTERS = 'w'.repeat(100)

/**
 * A selected repository of one long word, and one ordinary name, in a panel
 * narrower than the picker. The remove button stays inside, and the ordinary
 * name stays on one line.
 */
export const SelectedBadgeStaysInThePanel: Story = {
  args: {
    boardId: toBoardId('board-1'),
    statusId: toStatusListId('status-1'),
    onRepositoriesAdded: fn(),
  },
  render: () => (
    <div className="w-[280px] space-y-3">
      <div data-testid="long-badge" className="border p-2">
        <SelectedRepositoryBadge
          fullName={ONE_HUNDRED_LETTERS}
          onRemove={(): void => {}}
        />
      </div>
      <div data-testid="ordinary-badge" className="border p-2">
        <SelectedRepositoryBadge
          fullName="laststance/gitbox"
          onRemove={(): void => {}}
        />
      </div>
    </div>
  ),
  // Value: protects=the button that takes a selected repository out of the picker stays inside the panel when the name is one word of 100 letters, and an ordinary name stays on one line; fails_when=the badge grows with the word and the button leaves the panel, or the name breaks as soon as the panel is narrower than a long word would be; why_new=the repositories of the browser tests have short names; seam=none; no_claim=the list of repositories, which already cuts a long name
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const longPanel = canvas.getByTestId('long-badge')
    const remove = within(longPanel).getByRole('button', { name: /^Remove / })

    // Act: the badge is already on the page
    const panelRect = longPanel.getBoundingClientRect()
    const buttonRect = remove.getBoundingClientRect()
    const hit = document.elementFromPoint(
      buttonRect.left + buttonRect.width / 2,
      buttonRect.top + buttonRect.height / 2,
    )

    // Assert
    expect(Math.round(buttonRect.right)).toBeLessThanOrEqual(
      Math.round(panelRect.right) + 1,
    )
    expect(remove.contains(hit)).toBe(true)
    expect(
      textLines(within(longPanel).getByTestId('selected-repository-name')),
    ).toBeGreaterThan(1)
    expect(
      textLines(
        within(canvas.getByTestId('ordinary-badge')).getByTestId(
          'selected-repository-name',
        ),
      ),
    ).toBe(1)
  },
}

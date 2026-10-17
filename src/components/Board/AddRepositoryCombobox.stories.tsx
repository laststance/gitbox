/**
 * AddRepositoryCombobox Component Stories
 *
 * A combobox component for searching and adding GitHub repositories to a Kanban board.
 * Features virtual scrolling for 100+ repositories, multi-select support,
 * filtering by owner and visibility, and duplicate detection.
 * Integrates with GitHub API via server actions.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { memo, useState } from 'react'
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

const STORY_BOARD_ID = toBoardId('board-1')
const STORY_STATUS_ID = toStatusListId('status-1')

/** The picker, opened by a column's "Add Repo" button. */
const OpenedFromAColumn = memo(function OpenedFromAColumn() {
  const [isOpen, setIsOpen] = useState(false)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  return (
    <>
      <button
        type="button"
        onClick={(event): void => {
          setOpener(event.currentTarget)
          setIsOpen(true)
        }}
      >
        Add Repo
      </button>
      <AddRepositoryCombobox
        boardId={STORY_BOARD_ID}
        statusId={STORY_STATUS_ID}
        onRepositoriesAdded={(): void => undefined}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        focusReturnTarget={opener}
      />
    </>
  )
})

/** The picker as the page opens it again after GitHub sign-in. */
const OpenedAfterGitHubSignIn = memo(function OpenedAfterGitHubSignIn() {
  const [isOpen, setIsOpen] = useState(true)
  return (
    <AddRepositoryCombobox
      boardId={STORY_BOARD_ID}
      statusId={STORY_STATUS_ID}
      onRepositoriesAdded={(): void => undefined}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  )
})

const storyArgs = {
  boardId: STORY_BOARD_ID,
  statusId: STORY_STATUS_ID,
  onRepositoriesAdded: fn(),
}

/**
 * Escape from a picker the header opened puts the keyboard back on
 * "Add Repositories".
 */
export const EscapeReturnsToAddRepositories: Story = {
  args: storyArgs,
  // Value: protects=closing the picker with Escape puts the keyboard back on "Add Repositories"; fails_when=the focus falls to the page and a keyboard user starts again from the top of the board; why_new=the panel's Escape blurs the search box and nothing remembered the button; seam=none; no_claim=a column's "Add Repo" button
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Add Repositories' })

    // Act
    await userEvent.click(trigger)
    await waitFor(() => {
      expect(
        canvas.getByPlaceholderText('Search repositories...'),
      ).toBeVisible()
    })
    await userEvent.keyboard('{Escape}')

    // Assert
    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })
  },
}

/**
 * Cancel from a picker a column opened puts the keyboard back on "Add Repo".
 */
export const CancelReturnsToAddRepo: Story = {
  args: storyArgs,
  render: () => <OpenedFromAColumn />,
  // Value: protects=Cancel puts the keyboard back on the column's "Add Repo" button that opened the picker; fails_when=the focus falls to the page; why_new=the header button and a column button are different openers; seam=none; no_claim=the header button
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const addRepo = canvas.getByRole('button', { name: 'Add Repo' })

    // Act
    await userEvent.click(addRepo)
    await waitFor(() => {
      expect(
        canvas.getByPlaceholderText('Search repositories...'),
      ).toBeVisible()
    })
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))

    // Assert
    await waitFor(() => {
      expect(addRepo).toHaveFocus()
    })
  },
}

/**
 * A picker the page opened after GitHub sign-in has no column button. Cancel
 * puts the keyboard on the header button, and opening does not take it there
 * before the user closes.
 */
export const CancelAfterGitHubSignInReturnsToAddRepositories: Story = {
  args: storyArgs,
  render: () => <OpenedAfterGitHubSignIn />,
  // Value: protects=a picker opened again after GitHub sign-in returns the keyboard to "Add Repositories", and does not take it there while the panel is open; fails_when=the focus falls to the page, or the header button takes the focus as soon as the page opens the picker; why_new=that opening has no click to remember; seam=none; no_claim=which column the repositories are added to
  play: async ({ canvasElement }) => {
    // Arrange
    const canvas = within(canvasElement)
    const search = canvas.getByPlaceholderText('Search repositories...')
    const trigger = canvas.getByRole('button', { name: 'Add Repositories' })
    await waitFor(() => {
      expect(search).toHaveFocus()
    })

    // Act
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }))

    // Assert
    await waitFor(() => {
      expect(trigger).toHaveFocus()
    })
  },
}

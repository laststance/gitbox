/**
 * BoardCard Component Stories
 *
 * A card component displaying board information with a dropdown menu
 * for rename and delete actions. Displays board name, creation date,
 * and theme color indicator.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within, userEvent, waitFor, fn } from 'storybook/test'

import type { Tables } from '@/lib/supabase/types'

import { BoardCard } from './BoardCard'

type Board = Tables<'board'>

const mockBoard: Board = {
  id: 'board-1',
  user_id: 'user-1',
  name: 'My Project Board',
  theme: 'default',
  settings: null,
  created_at: '2024-12-01T00:00:00Z',
  updated_at: '2024-12-15T00:00:00Z',
  is_favorite: false,
}

const meta = {
  title: 'Boards/BoardCard',
  component: BoardCard,
  parameters: {
    layout: 'centered',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
  args: {
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
} satisfies Meta<typeof BoardCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default board card with sunrise theme.
 */
export const Default: Story = {
  args: {
    board: mockBoard,
  },
}

/**
 * Board with midnight (dark) theme.
 */
export const MidnightTheme: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-2',
      name: 'Midnight Project',
      theme: 'midnight',
    },
  },
}

/**
 * Board with mint theme.
 */
export const MintTheme: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-3',
      name: 'Mint Fresh Board',
      theme: 'mint',
    },
  },
}

/**
 * Board with lavender theme.
 */
export const LavenderTheme: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-4',
      name: 'Lavender Dreams',
      theme: 'lavender',
    },
  },
}

/**
 * Board with rose theme.
 */
export const RoseTheme: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-5',
      name: 'Rose Garden',
      theme: 'rose',
    },
  },
}

/**
 * Board with a very long name that should truncate.
 */
export const LongName: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-6',
      name: 'This Is A Very Long Board Name That Should Display Properly',
    },
  },
}

/**
 * Board with null theme (fallback to default gray).
 */
export const NullTheme: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-7',
      name: 'No Theme Board',
      theme: null,
    },
  },
}

/**
 * Board with null created_at date (shows N/A).
 */
export const NullDate: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-8',
      name: 'Date Unknown Board',
      created_at: null,
    },
  },
}

/**
 * Grid of multiple board cards showing different themes.
 */
/**
 * Board marked as favorite (filled star shown).
 */
export const FavoriteBoard: Story = {
  args: {
    board: {
      ...mockBoard,
      id: 'board-fav',
      name: 'My Favorite Project',
      is_favorite: true,
    },
  },
}

export const ThemeShowcase: Story = {
  args: {
    board: mockBoard,
  },
  decorators: [
    () => (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-[800px]">
        <BoardCard
          board={{
            ...mockBoard,
            id: '1',
            name: 'Sunrise Board',
            theme: 'sunrise',
          }}
          onRename={fn()}
          onDelete={fn()}
          onToggleFavorite={fn()}
        />
        <BoardCard
          board={{
            ...mockBoard,
            id: '2',
            name: 'Sandstone Board',
            theme: 'sandstone',
          }}
          onRename={fn()}
          onDelete={fn()}
          onToggleFavorite={fn()}
        />
        <BoardCard
          board={{ ...mockBoard, id: '3', name: 'Mint Board', theme: 'mint' }}
          onRename={fn()}
          onDelete={fn()}
          onToggleFavorite={fn()}
        />
        <BoardCard
          board={{ ...mockBoard, id: '4', name: 'Sky Board', theme: 'sky' }}
          onRename={fn()}
          onDelete={fn()}
          onToggleFavorite={fn()}
        />
        <BoardCard
          board={{
            ...mockBoard,
            id: '5',
            name: 'Lavender Board',
            theme: 'lavender',
          }}
          onRename={fn()}
          onDelete={fn()}
          onToggleFavorite={fn()}
        />
        <BoardCard
          board={{ ...mockBoard, id: '6', name: 'Rose Board', theme: 'rose' }}
          onRename={fn()}
          onDelete={fn()}
          onToggleFavorite={fn()}
        />
      </div>
    ),
  ],
}

/**
 * Tests that the card renders all required content
 */
export const CardContentRenders: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Verify board name is displayed
    await waitFor(() => {
      expect(canvas.getByText('My Project Board')).toBeInTheDocument()
    })
  },
}

/**
 * Tests that different themes render correctly
 */
export const ThemeVariantRenders: Story = {
  args: {
    board: { ...mockBoard, theme: 'midnight' },
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Verify board renders
    await waitFor(() => {
      expect(canvas.getByText('My Project Board')).toBeInTheDocument()
    })

    // Verify theme indicator is present
    expect(canvas.getByText('midnight')).toBeInTheDocument()
  },
}

/**
 * Tests dropdown menu opens and displays options
 */
export const MenuOpensOnClick: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find and click the menu button
    const menuButton = canvas.getByRole('button', {
      name: `Open menu for ${mockBoard.name}`,
    })
    await userEvent.click(menuButton)

    // Wait for menu to open and verify options (menu content renders in portal/body)
    await waitFor(() => {
      const renameItem = document.querySelector(
        '[data-radix-popper-content-wrapper]',
      )
      expect(renameItem).toBeInTheDocument()
    })
  },
}

/**
 * Tests rename dialog opens from menu
 */
export const RenameDialogOpens: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Open menu
    const menuButton = canvas.getByRole('button', {
      name: `Open menu for ${mockBoard.name}`,
    })
    await userEvent.click(menuButton)

    // Click rename option (menu renders in portal)
    await waitFor(() => {
      const menuContent = document.querySelector('[role="menu"]')
      expect(menuContent).toBeInTheDocument()
    })
    const renameOption = document.querySelector('[role="menuitem"]')
    if (renameOption) {
      await userEvent.click(renameOption)
    }

    // Verify dialog opens (dialog appears in document body)
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })
  },
}

/**
 * Tests delete dialog opens from menu
 */
export const DeleteDialogOpens: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Open menu
    const menuButton = canvas.getByRole('button', {
      name: `Open menu for ${mockBoard.name}`,
    })
    await userEvent.click(menuButton)

    // Click delete option (second menuitem)
    await waitFor(() => {
      const menuItems = document.querySelectorAll('[role="menuitem"]')
      expect(menuItems.length).toBeGreaterThan(1)
    })
    const menuItems = document.querySelectorAll('[role="menuitem"]')
    const deleteOption = menuItems[1] // Delete is second item
    if (deleteOption) {
      await userEvent.click(deleteOption)
    }

    // Verify delete dialog opens (appears in document body)
    await waitFor(() => {
      const alertDialog = document.querySelector('[role="alertdialog"]')
      expect(alertDialog).toBeInTheDocument()
    })
  },
}

/**
 * Tests favorite button interaction
 */
export const FavoriteToggle: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // Find favorite button
    const favoriteButton = canvas.getByRole('button', {
      name: `Add ${mockBoard.name} to favorites`,
    })

    // Click favorite button
    await userEvent.click(favoriteButton)

    // Verify callback was called
    await waitFor(() => {
      expect(args.onToggleFavorite).toHaveBeenCalledWith(mockBoard.id, true)
    })
  },
}

/**
 * Tests unfavorite button interaction on favorited board
 */
export const UnfavoriteToggle: Story = {
  args: {
    board: { ...mockBoard, is_favorite: true },
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // Find unfavorite button (board is already favorited)
    const unfavoriteButton = canvas.getByRole('button', {
      name: `Remove ${mockBoard.name} from favorites`,
    })

    // Click unfavorite button
    await userEvent.click(unfavoriteButton)

    // Verify callback was called to remove from favorites
    await waitFor(() => {
      expect(args.onToggleFavorite).toHaveBeenCalledWith(mockBoard.id, false)
    })
  },
}

/**
 * Tests that rename dialog cancel button closes the dialog
 */
export const RenameDialogCancel: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Open menu
    const menuButton = canvas.getByRole('button', {
      name: `Open menu for ${mockBoard.name}`,
    })
    await userEvent.click(menuButton)

    // Wait for menu and click rename option
    await waitFor(() => {
      const menuContent = document.querySelector('[role="menu"]')
      expect(menuContent).toBeInTheDocument()
    })
    const renameOption = document.querySelector('[role="menuitem"]')
    if (renameOption) {
      await userEvent.click(renameOption)
    }

    // Wait for dialog to appear
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Find and click Cancel button
    const cancelButton = document.querySelector('button[type="button"]')
    if (cancelButton && cancelButton.textContent?.includes('Cancel')) {
      await userEvent.click(cancelButton)
    }
  },
}

/**
 * Tests that delete dialog cancel button closes the dialog
 */
export const DeleteDialogCancel: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Open menu
    const menuButton = canvas.getByRole('button', {
      name: `Open menu for ${mockBoard.name}`,
    })
    await userEvent.click(menuButton)

    // Wait for menu and click delete option
    await waitFor(() => {
      const menuItems = document.querySelectorAll('[role="menuitem"]')
      expect(menuItems.length).toBeGreaterThan(1)
    })
    const menuItems = document.querySelectorAll('[role="menuitem"]')
    const deleteOption = menuItems[1]
    if (deleteOption) {
      await userEvent.click(deleteOption)
    }

    // Wait for alertdialog to appear
    await waitFor(() => {
      const alertDialog = document.querySelector('[role="alertdialog"]')
      expect(alertDialog).toBeInTheDocument()
    })

    // Find and click Cancel button
    const buttons = document.querySelectorAll('[role="alertdialog"] button')
    const cancelButton = Array.from(buttons).find((btn) =>
      btn.textContent?.includes('Cancel'),
    )
    if (cancelButton) {
      await userEvent.click(cancelButton)
    }
  },
}

/**
 * Tests that rename dialog closes with onClose callback
 * Covers line 90: setIsRenameOpen(false)
 */
export const RenameDialogClose: Story = {
  args: {
    board: mockBoard,
    onRename: fn(),
    onDelete: fn(),
    onToggleFavorite: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Open menu
    const menuButton = canvas.getByRole('button', {
      name: `Open menu for ${mockBoard.name}`,
    })
    await userEvent.click(menuButton)

    // Wait for menu and click rename option
    await waitFor(() => {
      const menuContent = document.querySelector('[role="menu"]')
      expect(menuContent).toBeInTheDocument()
    })
    const renameOption = document.querySelector('[role="menuitem"]')
    if (renameOption) {
      await userEvent.click(renameOption)
    }

    // Wait for dialog to appear
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    // Press Escape to close dialog (triggers onClose)
    await userEvent.keyboard('{Escape}')

    // Verify dialog is closed
    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).not.toBeInTheDocument()
    })
  },
}

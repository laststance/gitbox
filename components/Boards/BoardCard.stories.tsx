/**
 * BoardCard Component Stories
 *
 * A card component displaying board information with a dropdown menu
 * for rename and delete actions. Displays board name, creation date,
 * and theme color indicator.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'

import type { Tables } from '@/lib/supabase/types'

import { BoardCard } from './BoardCard'

type Board = Tables<'board'>

const mockBoard: Board = {
  id: 'board-1',
  user_id: 'user-1',
  name: 'My Project Board',
  theme: 'sunrise',
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

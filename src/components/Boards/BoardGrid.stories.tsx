/**
 * BoardGrid Component Stories
 *
 * A grid of board cards with optimistic UI updates for rename/delete operations.
 * Uses useOptimistic for instant feedback while server actions are in progress.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within, userEvent, waitFor } from 'storybook/test'

import type { Tables } from '@/lib/supabase/types'

import { BoardGrid } from './BoardGrid'

type Board = Tables<'board'>

const createMockBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  user_id: 'user-1',
  name: 'My Project Board',
  subtitle: null,
  settings: null,
  position: 0,
  created_at: '2024-12-01T00:00:00Z',
  updated_at: '2024-12-15T00:00:00Z',
  is_favorite: false,
  is_public: false,
  share_slug: null,
  ...overrides,
})

const mockBoards: Board[] = [
  createMockBoard({
    id: 'board-1',
    name: 'Frontend Development',
  }),
  createMockBoard({ id: 'board-2', name: 'Backend API' }),
  createMockBoard({ id: 'board-3', name: 'Design System' }),
  createMockBoard({ id: 'board-4', name: 'DevOps Pipeline' }),
  createMockBoard({ id: 'board-5', name: 'Documentation' }),
  createMockBoard({ id: 'board-6', name: 'Bug Fixes' }),
]

const meta = {
  title: 'Boards/BoardGrid',
  component: BoardGrid,
  parameters: {
    layout: 'padded',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-6xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BoardGrid>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default grid with multiple boards showing various themes.
 */
export const Default: Story = {
  args: {
    initialBoards: mockBoards,
  },
}

/**
 * Grid with a single board.
 */
export const SingleBoard: Story = {
  args: {
    initialBoards: [mockBoards[0]!],
  },
}

/**
 * Empty state when there are no boards.
 * Shows a placeholder with a "Create Board" button.
 */
export const EmptyState: Story = {
  args: {
    initialBoards: [],
  },
}

/**
 * Grid with two boards (tests responsive layout).
 */
export const TwoBoards: Story = {
  args: {
    initialBoards: mockBoards.slice(0, 2),
  },
}

/**
 * Grid with many boards to test scrolling behavior.
 */
export const ManyBoards: Story = {
  args: {
    initialBoards: [
      ...mockBoards,
      createMockBoard({
        id: 'board-7',
        name: 'Mobile App',
      }),
      createMockBoard({ id: 'board-8', name: 'Analytics' }),
      createMockBoard({
        id: 'board-9',
        name: 'Security Audit',
      }),
      createMockBoard({ id: 'board-10', name: 'Performance' }),
      createMockBoard({ id: 'board-11', name: 'Testing' }),
      createMockBoard({
        id: 'board-12',
        name: 'Infrastructure',
      }),
    ],
  },
}

/**
 * Grid with boards having long names to test text truncation.
 */
export const LongNames: Story = {
  args: {
    initialBoards: [
      createMockBoard({
        id: 'board-long-1',
        name: 'This Is An Extremely Long Board Name That Should Be Handled Gracefully',
      }),
      createMockBoard({
        id: 'board-long-2',
        name: 'Another Very Long Board Name For Testing Layout Behavior',
      }),
      createMockBoard({
        id: 'board-long-3',
        name: 'Yet Another Long Name To Verify Consistent Card Heights',
      }),
    ],
  },
}

/**
 * All light themes showcase.
 */
export const LightThemes: Story = {
  args: {
    initialBoards: [
      createMockBoard({ id: '1', name: 'Sunrise Theme' }),
      createMockBoard({ id: '2', name: 'Sandstone Theme' }),
      createMockBoard({ id: '3', name: 'Mint Theme' }),
      createMockBoard({ id: '4', name: 'Sky Theme' }),
      createMockBoard({ id: '5', name: 'Lavender Theme' }),
      createMockBoard({ id: '6', name: 'Rose Theme' }),
    ],
  },
}

/**
 * All dark themes showcase.
 */
export const DarkThemes: Story = {
  args: {
    initialBoards: [
      createMockBoard({ id: '1', name: 'Midnight Theme' }),
      createMockBoard({ id: '2', name: 'Graphite Theme' }),
      createMockBoard({ id: '3', name: 'Forest Theme' }),
      createMockBoard({ id: '4', name: 'Ocean Theme' }),
      createMockBoard({ id: '5', name: 'Plum Theme' }),
      createMockBoard({ id: '6', name: 'Rust Theme' }),
    ],
  },
}

/**
 * Tests grid renders with all board cards
 */
export const GridRendersCards: Story = {
  args: {
    initialBoards: mockBoards,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for all boards to render
    await waitFor(() => {
      expect(canvas.getByText('Frontend Development')).toBeInTheDocument()
      expect(canvas.getByText('Backend API')).toBeInTheDocument()
      expect(canvas.getByText('Design System')).toBeInTheDocument()
    })
  },
}

/**
 * Tests multiple boards render correctly
 */
export const MultipleBoardsRender: Story = {
  args: {
    initialBoards: mockBoards.slice(0, 4),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for all boards to render
    await waitFor(() => {
      expect(canvas.getByText('Frontend Development')).toBeInTheDocument()
      expect(canvas.getByText('Backend API')).toBeInTheDocument()
      expect(canvas.getByText('Design System')).toBeInTheDocument()
      expect(canvas.getByText('DevOps Pipeline')).toBeInTheDocument()
    })
  },
}

/**
 * Tests empty state displays correctly
 */
export const EmptyStateInteraction: Story = {
  args: {
    initialBoards: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for empty state message
    await waitFor(() => {
      expect(canvas.getByText('No boards yet')).toBeInTheDocument()
    })

    // Should have a create board button/link
    const createButton = canvas.getByRole('link', { name: /create.*board/i })
    expect(createButton).toBeInTheDocument()
  },
}

/**
 * Tests optimistic rename update
 */
export const OptimisticRename: Story = {
  args: {
    initialBoards: [mockBoards[0]!],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for board to render
    await waitFor(() => {
      expect(canvas.getByText('Frontend Development')).toBeInTheDocument()
    })

    // Open menu
    const menuButton = canvas.getByRole('button', {
      name: /open menu/i,
    })
    await userEvent.click(menuButton)

    // Click rename (triggers optimistic update flow)
    await waitFor(() => {
      const menuContent = document.querySelector('[role="menu"]')
      expect(menuContent).toBeInTheDocument()
    })
    const renameOption = document.querySelector('[role="menuitem"]')
    if (renameOption) {
      await userEvent.click(renameOption)
    }
  },
}

/**
 * Tests optimistic favorite toggle update
 */
export const OptimisticFavoriteToggle: Story = {
  args: {
    initialBoards: [mockBoards[0]!],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for board to render
    await waitFor(() => {
      expect(canvas.getByText('Frontend Development')).toBeInTheDocument()
    })

    // Find and click favorite button (triggers optimistic update)
    const favoriteButton = canvas.getByRole('button', {
      name: /add.*favorites/i,
    })
    await userEvent.click(favoriteButton)

    // After click, button should change to "remove from favorites"
    await waitFor(() => {
      const updatedButton = canvas.getByRole('button', {
        name: /remove.*favorites/i,
      })
      expect(updatedButton).toBeInTheDocument()
    })
  },
}

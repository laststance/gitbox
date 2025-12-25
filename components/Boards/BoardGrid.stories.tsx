/**
 * BoardGrid Component Stories
 *
 * A grid of board cards with optimistic UI updates for rename/delete operations.
 * Uses useOptimistic for instant feedback while server actions are in progress.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import type { Tables } from '@/lib/supabase/types'

import { BoardGrid } from './BoardGrid'

type Board = Tables<'board'>

const createMockBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  user_id: 'user-1',
  name: 'My Project Board',
  theme: 'sunrise',
  settings: null,
  created_at: '2024-12-01T00:00:00Z',
  updated_at: '2024-12-15T00:00:00Z',
  ...overrides,
})

const mockBoards: Board[] = [
  createMockBoard({
    id: 'board-1',
    name: 'Frontend Development',
    theme: 'sunrise',
  }),
  createMockBoard({ id: 'board-2', name: 'Backend API', theme: 'midnight' }),
  createMockBoard({ id: 'board-3', name: 'Design System', theme: 'mint' }),
  createMockBoard({ id: 'board-4', name: 'DevOps Pipeline', theme: 'sky' }),
  createMockBoard({ id: 'board-5', name: 'Documentation', theme: 'lavender' }),
  createMockBoard({ id: 'board-6', name: 'Bug Fixes', theme: 'rose' }),
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
      <div className="max-w-6xl mx-auto p-4">
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
    initialBoards: [mockBoards[0]],
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
        theme: 'sandstone',
      }),
      createMockBoard({ id: 'board-8', name: 'Analytics', theme: 'graphite' }),
      createMockBoard({
        id: 'board-9',
        name: 'Security Audit',
        theme: 'forest',
      }),
      createMockBoard({ id: 'board-10', name: 'Performance', theme: 'ocean' }),
      createMockBoard({ id: 'board-11', name: 'Testing', theme: 'plum' }),
      createMockBoard({
        id: 'board-12',
        name: 'Infrastructure',
        theme: 'rust',
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
        theme: 'sunrise',
      }),
      createMockBoard({
        id: 'board-long-2',
        name: 'Another Very Long Board Name For Testing Layout Behavior',
        theme: 'midnight',
      }),
      createMockBoard({
        id: 'board-long-3',
        name: 'Yet Another Long Name To Verify Consistent Card Heights',
        theme: 'mint',
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
      createMockBoard({ id: '1', name: 'Sunrise Theme', theme: 'sunrise' }),
      createMockBoard({ id: '2', name: 'Sandstone Theme', theme: 'sandstone' }),
      createMockBoard({ id: '3', name: 'Mint Theme', theme: 'mint' }),
      createMockBoard({ id: '4', name: 'Sky Theme', theme: 'sky' }),
      createMockBoard({ id: '5', name: 'Lavender Theme', theme: 'lavender' }),
      createMockBoard({ id: '6', name: 'Rose Theme', theme: 'rose' }),
    ],
  },
}

/**
 * All dark themes showcase.
 */
export const DarkThemes: Story = {
  args: {
    initialBoards: [
      createMockBoard({ id: '1', name: 'Midnight Theme', theme: 'midnight' }),
      createMockBoard({ id: '2', name: 'Graphite Theme', theme: 'graphite' }),
      createMockBoard({ id: '3', name: 'Forest Theme', theme: 'forest' }),
      createMockBoard({ id: '4', name: 'Ocean Theme', theme: 'ocean' }),
      createMockBoard({ id: '5', name: 'Plum Theme', theme: 'plum' }),
      createMockBoard({ id: '6', name: 'Rust Theme', theme: 'rust' }),
    ],
  },
}

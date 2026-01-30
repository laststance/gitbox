/**
 * BoardPageClient Component Stories
 *
 * The main client component for the Kanban board page.
 * Integrates KanbanBoard, AddRepositoryCombobox, ProjectInfoModal, and StatusListDialog.
 * Handles board data management, card editing, and status column CRUD operations.
 * Uses Redux for state management and server actions for data persistence.
 *
 * Phase 4: Added initialData prop for Server Component data passing
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import type { BoardInitialData } from '@/lib/actions/board-data'

import { BoardPageClient } from './BoardPageClient'

const meta = {
  title: 'Pages/BoardPageClient',
  component: BoardPageClient,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BoardPageClient>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Create a mock board object for Storybook
 */
const createMockBoard = (
  overrides?: Partial<{
    id: string
    name: string
    theme: string | null
  }>,
) => ({
  id: overrides?.id ?? 'board-1',
  name: overrides?.name ?? 'My Kanban Board',
  theme: overrides?.theme ?? null,
  settings: null,
  user_id: 'user-1',
  is_favorite: false,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
})

/**
 * Create mock initial data (Phase 4: Server Component data passing)
 */
const createMockInitialData = (): BoardInitialData => ({
  statusLists: [
    {
      id: 'status-1',
      title: 'To Do',
      color: '#6B7280',
      gridRow: 0,
      gridCol: 0,
      boardId: 'board-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'status-2',
      title: 'In Progress',
      color: '#3B82F6',
      gridRow: 0,
      gridCol: 1,
      boardId: 'board-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'status-3',
      title: 'Done',
      color: '#22C55E',
      gridRow: 0,
      gridCol: 2,
      boardId: 'board-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  repoCards: [],
  comments: {},
  maintenanceRepoIdentifiers: [],
})

export const Default: Story = {
  args: {
    board: createMockBoard(),
    initialData: createMockInitialData(),
  },
}

export const WithLongBoardName: Story = {
  args: {
    board: createMockBoard({
      id: 'board-2',
      name: 'Very Long Board Name That Might Overflow',
    }),
    initialData: createMockInitialData(),
  },
}

/**
 * Board with custom theme
 */
export const WithTheme: Story = {
  args: {
    board: createMockBoard({
      id: 'board-3',
      name: 'Themed Board',
      theme: 'ocean',
    }),
    initialData: createMockInitialData(),
  },
}

/**
 * Board with repo cards in status columns
 */
export const WithRepoCards: Story = {
  args: {
    board: createMockBoard(),
    initialData: {
      ...createMockInitialData(),
      repoCards: [
        {
          id: 'card-1',
          title: 'react',
          repoOwner: 'facebook',
          repoName: 'react',
          statusId: 'status-1',
          order: 0,
          boardId: 'board-1',
          meta: { stars: 200000, language: 'JavaScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'card-2',
          title: 'next.js',
          repoOwner: 'vercel',
          repoName: 'next.js',
          statusId: 'status-2',
          order: 0,
          boardId: 'board-1',
          meta: { stars: 100000, language: 'TypeScript' },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      comments: {
        'card-1': { comment: 'Initial setup', color: 'neutral' },
      },
    },
  },
}

/**
 * Empty board with no status columns
 */
export const EmptyBoard: Story = {
  args: {
    board: createMockBoard({
      name: 'Empty Board',
    }),
    initialData: {
      statusLists: [],
      repoCards: [],
      comments: {},
      maintenanceRepoIdentifiers: [],
    },
  },
}

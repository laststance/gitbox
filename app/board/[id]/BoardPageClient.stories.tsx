/**
 * BoardPageClient Component Stories
 *
 * The main client component for the Kanban board page.
 * Integrates KanbanBoard, AddRepositoryCombobox, ProjectInfoModal, and StatusListDialog.
 * Handles board data management, card editing, and status column CRUD operations.
 * Uses Redux for state management and server actions for data persistence.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

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

export const Default: Story = {
  args: {
    board: createMockBoard(),
  },
}

export const WithLongBoardName: Story = {
  args: {
    board: createMockBoard({
      id: 'board-2',
      name: 'Very Long Board Name That Might Overflow',
    }),
  },
}

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

export const Default: Story = {
  args: {
    boardId: 'board-1',
    boardName: 'My Kanban Board',
  },
}

export const WithLongBoardName: Story = {
  args: {
    boardId: 'board-2',
    boardName: 'Very Long Board Name That Might Overflow',
  },
}

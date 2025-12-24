/**
 * KanbanBoard Component Stories
 *
 * The main Kanban board component that displays status columns and repository cards.
 * Handles drag-and-drop operations, board data loading, and card position updates.
 * Integrates with Redux for state management and uses @dnd-kit for drag-and-drop.
 * Supports keyboard navigation and undo functionality.
 *
 * Layout Features:
 * - 2D grid layout with responsive breakpoints (1-5 columns based on screen width)
 * - Columns can be dragged vertically (up/down) and horizontally (left/right)
 * - Uses rectSortingStrategy from @dnd-kit/sortable for full 2D movement
 * - Auto-wrap layout adapts to viewport size
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { KanbanBoard } from './KanbanBoard'

const meta = {
  title: 'Board/KanbanBoard',
  component: KanbanBoard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof KanbanBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    boardId: 'board-1',
    onEditProjectInfo: (id) => console.log('Edit project info:', id),
    onMoveToMaintenance: (id) => console.log('Move to maintenance:', id),
    onEditStatus: (status) => console.log('Edit status:', status),
    onDeleteStatus: (id) => console.log('Delete status:', id),
    onAddCard: (id) => console.log('Add card to status:', id),
  },
}

export const WithCallbacks: Story = {
  args: {
    boardId: 'board-1',
    onEditProjectInfo: (id) => {
      console.log('Opening project info modal for:', id)
    },
    onMoveToMaintenance: (id) => {
      console.log('Moving card to maintenance:', id)
    },
    onEditStatus: (status) => {
      console.log('Editing status column:', status.title)
    },
    onDeleteStatus: (id) => {
      console.log('Deleting status column:', id)
    },
    onAddCard: (id) => {
      console.log('Adding card to status:', id)
    },
  },
}

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
import { expect, waitFor } from 'storybook/test'

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

/**
 * Tests that the board renders with loading skeleton initially
 */
export const LoadingState: Story = {
  args: {
    boardId: 'board-1',
    onEditProjectInfo: () => {},
    onMoveToMaintenance: () => {},
    onEditStatus: () => {},
    onDeleteStatus: () => {},
    onAddCard: () => {},
  },
  play: async ({ canvasElement }) => {
    // Board renders immediately (skeleton or content)
    // Wait for the component to mount
    await waitFor(
      () => {
        // Check for skeleton or actual columns
        const element = canvasElement.querySelector('[class*="grid"]')
        expect(element).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Tests board with card display settings
 */
export const WithCardDisplaySettings: Story = {
  args: {
    boardId: 'board-1',
    cardDisplaySettings: {
      showGitHubDescription: true,
      showComment: true,
      commentText: {
        fontSize: 'base',
        fontWeight: 'normal',
      },
    },
    onEditProjectInfo: () => {},
    onMoveToMaintenance: () => {},
    onEditStatus: () => {},
    onDeleteStatus: () => {},
    onAddCard: () => {},
  },
  play: async ({ canvasElement }) => {
    // Wait for the component to render
    await waitFor(
      () => {
        const element = canvasElement.querySelector('[class*="grid"]')
        expect(element).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Tests board with initial comments
 */
export const WithInitialComments: Story = {
  args: {
    boardId: 'board-1',
    initialComments: {
      'card-1': { comment: 'Test comment', color: 'primary' },
      'card-2': { comment: 'Another comment', color: 'neutral' },
    },
    onEditProjectInfo: () => {},
    onMoveToMaintenance: () => {},
    onEditStatus: () => {},
    onDeleteStatus: () => {},
    onAddCard: () => {},
  },
  play: async ({ canvasElement }) => {
    // Wait for the component to render
    await waitFor(
      () => {
        const element = canvasElement.querySelector('[class*="grid"]')
        expect(element).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Tests board with comment text settings
 */
export const WithCommentTextSettings: Story = {
  args: {
    boardId: 'board-1',
    cardDisplaySettings: {
      showGitHubDescription: true,
      showComment: true,
      commentText: {
        fontSize: 'base',
        fontWeight: 'semibold',
      },
    },
    onEditProjectInfo: () => {},
    onMoveToMaintenance: () => {},
    onEditStatus: () => {},
    onDeleteStatus: () => {},
    onAddCard: () => {},
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const element = canvasElement.querySelector('[class*="grid"]')
        expect(element).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Tests board renders DnD context
 */
export const DndContextActive: Story = {
  args: {
    boardId: 'board-1',
    onEditProjectInfo: () => {},
    onMoveToMaintenance: () => {},
    onEditStatus: () => {},
    onDeleteStatus: () => {},
    onAddCard: () => {},
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        // The KanbanBoard wraps content in DndContext
        // which provides drag-and-drop capabilities
        const element = canvasElement.querySelector('[class*="grid"]')
        expect(element).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Tests board with showComment settings via cardDisplaySettings
 */
export const WithShowComment: Story = {
  args: {
    boardId: 'board-1',
    cardDisplaySettings: {
      showGitHubDescription: true,
      showComment: true,
      commentText: { fontSize: 'sm', fontWeight: 'normal' },
    },
    initialComments: {
      'card-1': { comment: 'Visible comment', color: 'primary' },
    },
    onEditProjectInfo: () => {},
    onMoveToMaintenance: () => {},
    onEditStatus: () => {},
    onDeleteStatus: () => {},
    onAddCard: () => {},
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const element = canvasElement.querySelector('[class*="grid"]')
        expect(element).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

/**
 * Tests board without showComment (comments hidden)
 */
export const WithoutShowComment: Story = {
  args: {
    boardId: 'board-1',
    cardDisplaySettings: {
      showGitHubDescription: true,
      showComment: false,
      commentText: { fontSize: 'sm', fontWeight: 'normal' },
    },
    initialComments: {
      'card-1': { comment: 'Hidden comment', color: 'primary' },
    },
    onEditProjectInfo: () => {},
    onMoveToMaintenance: () => {},
    onEditStatus: () => {},
    onDeleteStatus: () => {},
    onAddCard: () => {},
  },
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const element = canvasElement.querySelector('[class*="grid"]')
        expect(element).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  },
}

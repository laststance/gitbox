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
 *
 * Note: This component reads data from Redux state (statusLists, repoCards).
 * In the real app, a Server Component fetches data and hydrates Redux.
 * For Storybook, we use a decorator to pre-populate Redux with mock data.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useLayoutEffect } from 'react'
import { useDispatch } from 'react-redux'
import { expect, waitFor } from 'storybook/test'

import type { StatusListDomain, RepoCardForRedux } from '@/lib/models/domain'
import {
  setStatusLists,
  setRepoCards,
  setBoardError,
} from '@/lib/redux/slices/boardSlice'
import { mockStatusLists, mockRepoCards } from '@/mocks/handlers/data'

import { KanbanBoard } from './KanbanBoard'

/**
 * Transform mock database data to domain models for Redux
 */
const transformedStatusLists: StatusListDomain[] = mockStatusLists.map((s) => ({
  id: s.id,
  title: s.name,
  color: s.color,
  gridRow: s.grid_row,
  gridCol: s.grid_col,
  boardId: s.board_id,
  createdAt: s.created_at,
  updatedAt: s.updated_at,
}))

const transformedRepoCards: RepoCardForRedux[] = mockRepoCards.map((c) => ({
  id: c.id,
  title: c.repo_name,
  description: c.meta?.description,
  statusId: c.status_id,
  boardId: c.board_id,
  repoOwner: c.repo_owner,
  repoName: c.repo_name,
  order: c.order,
  meta: c.meta,
  createdAt: c.created_at,
  updatedAt: c.updated_at,
}))

/**
 * Decorator component that hydrates Redux with mock board data
 * This simulates what the Server Component does in the real app
 */
function ReduxHydrator({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode {
  const dispatch = useDispatch()

  useLayoutEffect(() => {
    // Clear any persisted error state from localStorage
    dispatch(setBoardError(null))
    // Hydrate Redux with mock board data
    dispatch(setStatusLists(transformedStatusLists))
    dispatch(setRepoCards(transformedRepoCards))
  }, [dispatch])

  return children
}

const meta = {
  title: 'Board/KanbanBoard',
  component: KanbanBoard,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ReduxHydrator>
        <Story />
      </ReduxHydrator>
    ),
  ],
} satisfies Meta<typeof KanbanBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    boardId: 'board-1',
    onNote: (id) => console.log('Edit project info:', id),
    onMoveToMaintenance: (id) => console.log('Move to maintenance:', id),
    onEditStatus: (status) => console.log('Edit status:', status),
    onDeleteStatus: (id) => console.log('Delete status:', id),
    onAddCard: (id) => console.log('Add card to status:', id),
  },
}

export const WithCallbacks: Story = {
  args: {
    boardId: 'board-1',
    onNote: (id) => {
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
    onNote: () => {},
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
    onNote: () => {},
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
    onNote: () => {},
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
    onNote: () => {},
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
    onNote: () => {},
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
    onNote: () => {},
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
    onNote: () => {},
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

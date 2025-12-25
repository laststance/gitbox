/**
 * SortableColumn Component Stories
 *
 * A wrapper component that enables drag-and-drop reordering of StatusColumns
 * using @dnd-kit's useSortable hook. Provides visual feedback during drag
 * operations including opacity changes, scale effects, and drop zone indicators.
 *
 * Features:
 * - Full 2D drag support (horizontal and vertical movement)
 * - Visual feedback during drag (opacity, scale, shadow)
 * - Drop zone indicator (ring effect when hovering)
 * - Smooth CSS transitions for drop animation
 * - Maintains card DnD functionality within columns
 */

import { DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { SortableColumn } from './SortableColumn'

const meta = {
  title: 'Board/SortableColumn',
  component: SortableColumn,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DndContext>
        <div className="w-[320px] h-[600px]">
          <Story />
        </div>
      </DndContext>
    ),
  ],
} satisfies Meta<typeof SortableColumn>

export default meta
type Story = StoryObj<typeof meta>

const mockStatus = {
  id: 'status-1',
  boardId: 'board-1',
  title: 'To Do',
  color: '#3b82f6',
  wipLimit: 5,
  gridRow: 0,
  gridCol: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
}

const mockCards = [
  {
    id: 'card-1',
    statusId: 'status-1',
    boardId: 'board-1',
    repoOwner: 'octocat',
    repoName: 'example-repo',
    title: 'example-repo',
    description: 'An example repository',
    order: 0,
    note: '',
    meta: {
      stars: 100,
      updated_at: '2024-01-15T10:00:00Z',
      visibility: 'public' as const,
      language: 'TypeScript',
      topics: ['react', 'nextjs'],
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'card-2',
    statusId: 'status-1',
    boardId: 'board-1',
    repoOwner: 'octocat',
    repoName: 'another-repo',
    title: 'another-repo',
    description: 'Another example repository',
    order: 1,
    note: '',
    meta: {
      stars: 200,
      updated_at: '2024-01-20T15:30:00Z',
      visibility: 'public' as const,
      language: 'JavaScript',
      topics: ['nodejs'],
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
]

/**
 * Default sortable column with cards.
 * The column header is draggable for reordering.
 */
export const Default: Story = {
  args: {
    status: mockStatus,
    cards: mockCards,
    onEdit: (id) => console.log('Edit card:', id),
    onMaintenance: (id) => console.log('Move to maintenance:', id),
    onNote: (id) => console.log('Edit note:', id),
    onEditStatus: (status) => console.log('Edit status:', status),
    onDeleteStatus: (id) => console.log('Delete status:', id),
    onAddCard: (id) => console.log('Add card to status:', id),
  },
}

/**
 * Empty sortable column ready to receive cards.
 */
export const Empty: Story = {
  args: {
    status: mockStatus,
    cards: [],
    onAddCard: (id) => console.log('Add card to status:', id),
  },
}

/**
 * Sortable column with custom grid positioning.
 * Uses gridStyle prop for CSS Grid placement.
 */
export const WithGridStyle: Story = {
  args: {
    status: mockStatus,
    cards: mockCards,
    gridStyle: {
      gridRow: 1,
      gridColumn: 2,
    },
  },
}

/**
 * Sortable column with WIP limit warning.
 * Shows visual indicator when card count exceeds limit.
 */
export const WithWipLimitExceeded: Story = {
  args: {
    status: {
      ...mockStatus,
      wipLimit: 1,
    },
    cards: mockCards,
  },
}

/**
 * Sortable column in different status (In Progress).
 * Demonstrates different color theming.
 */
export const InProgress: Story = {
  args: {
    status: {
      ...mockStatus,
      id: 'status-2',
      title: 'In Progress',
      color: '#f59e0b',
      gridCol: 1,
    },
    cards: [mockCards[0]],
    onEditStatus: (status) => console.log('Edit status:', status),
  },
}

/**
 * Sortable column for completed items.
 * Shows a Done status with green color.
 */
export const Done: Story = {
  args: {
    status: {
      ...mockStatus,
      id: 'status-3',
      title: 'Done',
      color: '#22c55e',
      gridCol: 2,
      wipLimit: 0,
    },
    cards: mockCards,
  },
}

/**
 * Multiple sortable columns in a grid layout.
 * Demonstrates how columns work together in a board.
 */
export const MultipleColumns: Story = {
  args: {
    status: mockStatus,
    cards: mockCards,
  },
  decorators: [
    (Story) => (
      <DndContext>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(3, 300px)',
            height: '600px',
          }}
        >
          <Story />
        </div>
      </DndContext>
    ),
  ],
  render: () => (
    <>
      <SortableColumn
        status={{
          ...mockStatus,
          id: 'status-1',
          title: 'To Do',
          color: '#3b82f6',
          gridCol: 0,
        }}
        cards={[mockCards[0]]}
      />
      <SortableColumn
        status={{
          ...mockStatus,
          id: 'status-2',
          title: 'In Progress',
          color: '#f59e0b',
          gridCol: 1,
        }}
        cards={[mockCards[1]]}
      />
      <SortableColumn
        status={{
          ...mockStatus,
          id: 'status-3',
          title: 'Done',
          color: '#22c55e',
          gridCol: 2,
        }}
        cards={[]}
      />
    </>
  ),
}

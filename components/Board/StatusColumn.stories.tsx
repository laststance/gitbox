/**
 * StatusColumn Component Stories
 *
 * A column component representing a status list in the Kanban board.
 * Displays status title, color indicator, and contains draggable repository cards.
 * Supports column actions (add card, edit, delete).
 *
 * The column now supports 2D grid layout with vertical drag-and-drop.
 * When used with SortableColumn wrapper, columns can be reordered in any direction.
 */

import { DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { StatusColumn } from './StatusColumn'

const meta = {
  title: 'Board/StatusColumn',
  component: StatusColumn,
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
} satisfies Meta<typeof StatusColumn>

export default meta
type Story = StoryObj<typeof meta>

const mockStatus = {
  id: 'status-1',
  boardId: 'board-1',
  title: 'Planning',
  color: '#3b82f6',
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

export const Default: Story = {
  args: {
    status: mockStatus,
    cards: mockCards,
    onMaintenance: (id) => console.log('Move to maintenance:', id),
    onNote: (id) => console.log('Edit note:', id),
    onEditStatus: (status) => console.log('Edit status:', status),
    onDeleteStatus: (id) => console.log('Delete status:', id),
    onAddCard: (id) => console.log('Add card to status:', id),
  },
}

export const Empty: Story = {
  args: {
    status: mockStatus,
    cards: [],
    onAddCard: (id) => console.log('Add card to status:', id),
  },
}

export const WithoutColor: Story = {
  args: {
    status: {
      ...mockStatus,
      color: '',
    },
    cards: mockCards,
  },
}

/**
 * Demonstrates the draggable header styling (Trello-style).
 * When used within SortableColumn, the header receives drag attributes
 * that enable column reordering.
 */
export const WithDraggableHeader: Story = {
  args: {
    status: mockStatus,
    cards: mockCards,
    onAddCard: (id) => console.log('Add card to status:', id),
    onEditStatus: (status) => console.log('Edit status:', status),
    onDeleteStatus: (id) => console.log('Delete status:', id),
    // Mock drag attributes to show the draggable styling
    dragAttributes: {
      role: 'button',
      tabIndex: 0,
      'aria-roledescription': 'sortable',
    },
    dragListeners: {},
  },
}

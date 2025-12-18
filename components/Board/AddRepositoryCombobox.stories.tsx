/**
 * AddRepositoryCombobox Component Stories
 *
 * A combobox component for searching and adding GitHub repositories to a Kanban board.
 * Features virtual scrolling for 100+ repositories, multi-select support,
 * filtering by owner and visibility, and duplicate detection.
 * Integrates with GitHub API via server actions.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { AddRepositoryCombobox } from './AddRepositoryCombobox'

const meta = {
  title: 'Board/AddRepositoryCombobox',
  component: AddRepositoryCombobox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AddRepositoryCombobox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    boardId: 'board-1',
    statusId: 'status-1',
    onRepositoriesAdded: () => console.log('Repositories added'),
    onQuickNoteFocus: () => console.log('Quick note focused'),
  },
}

export const WithCallbacks: Story = {
  args: {
    boardId: 'board-1',
    statusId: 'status-1',
    onRepositoriesAdded: () => {
      console.log('Repositories added successfully')
    },
    onQuickNoteFocus: () => {
      console.log('Focus moved to quick note')
    },
  },
}

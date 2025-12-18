/**
 * StatusListDialog Component Stories
 *
 * A dialog component for creating and editing status columns in the Kanban board.
 * Allows setting column name, color (with preset options and custom color picker),
 * and WIP (Work In Progress) limit. Supports both create and edit modes with
 * proper form validation and error handling.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { StatusListDialog } from './StatusListDialog'

const meta = {
  title: 'Modals/StatusListDialog',
  component: StatusListDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StatusListDialog>

export default meta
type Story = StoryObj<typeof meta>

const mockStatusList = {
  id: 'status-1',
  boardId: 'board-1',
  title: 'In Progress',
  color: '#4682B4',
  wipLimit: 5,
  order: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
}

export const CreateMode: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: () => console.log('Dialog closed'),
    onSave: async (data) => {
      console.log('Creating status:', data)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
  },
}

export const EditMode: Story = {
  args: {
    isOpen: true,
    mode: 'edit',
    statusList: mockStatusList,
    onClose: () => console.log('Dialog closed'),
    onSave: async (data) => {
      console.log('Updating status:', data)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
  },
}

export const WithWipLimit: Story = {
  args: {
    isOpen: true,
    mode: 'create',
    onClose: () => console.log('Dialog closed'),
    onSave: async (data) => {
      console.log('Creating status with WIP limit:', data)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
  },
  render: (args) => <StatusListDialog {...args} />,
}

export const WithoutWipLimit: Story = {
  args: {
    isOpen: true,
    mode: 'edit',
    statusList: {
      ...mockStatusList,
      wipLimit: 0,
    },
    onClose: () => console.log('Dialog closed'),
    onSave: async (data) => {
      console.log('Updating status without WIP limit:', data)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
  },
}

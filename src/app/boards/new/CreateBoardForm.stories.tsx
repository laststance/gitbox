/**
 * CreateBoardForm Component Stories
 *
 * A form component for creating a new Kanban board.
 * Features name input with validation and theme selection with live preview.
 * Uses useTransition for pending states during board creation.
 *
 * Note: Detailed interaction tests are in tests/unit/components/CreateBoardForm.test.tsx
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { CreateBoardForm } from './CreateBoardForm'

const meta = {
  title: 'Boards/CreateBoardForm',
  component: CreateBoardForm,
  parameters: {
    layout: 'centered',
    nextjs: {
      appDirectory: true,
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background w-150 rounded-lg border p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateBoardForm>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default form state showing name input and theme selection
 */
export const Default: Story = {}

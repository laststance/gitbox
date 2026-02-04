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
      <div className="w-150 p-6 bg-background rounded-lg border">
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

/**
 * CommentInlineEdit Component Stories
 *
 * Inline editor for RepoCard comments with auto-save capability.
 * Phase 4: Inline Edit implementation
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'

import { CommentInlineEdit } from './CommentInlineEdit'

const meta = {
  title: 'Board/CommentInlineEdit',
  component: CommentInlineEdit,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[320px] p-4 bg-card rounded-lg border">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    initialValue: {
      control: 'text',
      description: 'Initial comment text',
    },
    maxLength: {
      control: { type: 'number', min: 50, max: 500 },
      description: 'Maximum character limit',
    },
    autoFocus: {
      control: 'boolean',
      description: 'Auto-focus textarea on mount',
    },
    enableAutoSave: {
      control: 'boolean',
      description: 'Enable auto-save with debounce',
    },
  },
} satisfies Meta<typeof CommentInlineEdit>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default empty state
 */
export const Empty: Story = {
  args: {
    initialValue: '',
    onSave: async (value) => {
      console.log('Saved:', value)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onCancel: () => console.log('Cancelled'),
  },
}

/**
 * With existing comment
 */
export const WithValue: Story = {
  args: {
    initialValue: 'npmリリース完了、当分は機能追加予定なし',
    onSave: async (value) => {
      console.log('Saved:', value)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onCancel: () => console.log('Cancelled'),
  },
}

/**
 * Long comment approaching limit
 */
export const LongComment: Story = {
  args: {
    initialValue:
      'プロトタイプ作ったけど微妙、差分表示エディタで苦戦中。リファクタリング予定あり。チームでレビュー待ち。来週のリリースに向けて準備中。バグ修正とパフォーマンス改善も必要。',
    onSave: async (value) => {
      console.log('Saved:', value)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onCancel: () => console.log('Cancelled'),
  },
}

/**
 * Warning state (> 270 characters)
 */
export const WarningState: Story = {
  args: {
    initialValue:
      'This is a very long comment that is approaching the character limit. We want to show the warning state when the user types more than 270 characters. The counter should turn orange to indicate that they are close to the limit.',
    onSave: async (value) => {
      console.log('Saved:', value)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onCancel: () => console.log('Cancelled'),
  },
}

/**
 * Over limit state (> 300 characters)
 */
export const OverLimit: Story = {
  args: {
    initialValue:
      'This comment exceeds the maximum character limit of 300 characters. The counter should turn red and the save button should be disabled. This is to prevent users from submitting comments that are too long for the database to store. The textarea should still allow typing but saving should not be possible.',
    onSave: async (value) => {
      console.log('Saved:', value)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onCancel: () => console.log('Cancelled'),
  },
}

// ============================================================================
// Style Variants
// ============================================================================

/**
 * Blue border accent
 */
export const BlueBorder: Story = {
  args: {
    initialValue: 'Blue border accent',
    style: { borderColor: 'blue' },
    onSave: async (value) => {
      console.log('Saved:', value)
    },
    onCancel: () => console.log('Cancelled'),
  },
}

/**
 * Green border accent
 */
export const GreenBorder: Story = {
  args: {
    initialValue: 'Green border accent',
    style: { borderColor: 'green' },
    onSave: async (value) => {
      console.log('Saved:', value)
    },
    onCancel: () => console.log('Cancelled'),
  },
}

/**
 * Amber border accent
 */
export const AmberBorder: Story = {
  args: {
    initialValue: 'Amber border accent',
    style: { borderColor: 'amber' },
    onSave: async (value) => {
      console.log('Saved:', value)
    },
    onCancel: () => console.log('Cancelled'),
  },
}

// ============================================================================
// Interactive Examples
// ============================================================================

/**
 * Interactive example with state management
 */
export const Interactive: Story = {
  args: {
    initialValue: '',
    onSave: async () => {},
    onCancel: () => {},
  },
  render: function InteractiveStory() {
    const [isEditing, setIsEditing] = useState(true)
    const [savedValue, setSavedValue] = useState('Click to edit this comment')

    if (!isEditing) {
      return (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full text-left p-3 border rounded-md hover:bg-muted/50"
          >
            {savedValue || 'Click to add comment'}
          </button>
          <p className="text-xs text-muted-foreground">Click to edit</p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <CommentInlineEdit
          initialValue={savedValue}
          onSave={async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 300))
            setSavedValue(value)
            setIsEditing(false)
          }}
          onCancel={() => setIsEditing(false)}
        />
        <p className="text-xs text-muted-foreground">
          Press Enter to save, Escape to cancel
        </p>
      </div>
    )
  },
}

/**
 * Auto-save disabled (manual save only)
 */
export const ManualSaveOnly: Story = {
  args: {
    initialValue: 'Edit this comment (auto-save disabled)',
    enableAutoSave: false,
    onSave: async (value) => {
      console.log('Manually saved:', value)
      await new Promise((resolve) => setTimeout(resolve, 500))
    },
    onCancel: () => console.log('Cancelled'),
  },
}

/**
 * Custom max length (100 characters)
 */
export const CustomMaxLength: Story = {
  args: {
    initialValue: 'Short limit example',
    maxLength: 100,
    onSave: async (value) => {
      console.log('Saved:', value)
    },
    onCancel: () => console.log('Cancelled'),
  },
}

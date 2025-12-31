/**
 * CommentInlineEdit Component Stories
 *
 * Inline editor for RepoCard comments with onBlur auto-save.
 * Phase 4: Inline Edit implementation
 *
 * Interaction Tests:
 * - TypeText: Verify continuous typing without losing focus
 * - OnBlurAutoSave: Verify auto-save when focus is lost (closeOnSave: false)
 * - EnterKeyManualSave: Verify manual save with Enter key (closeOnSave: true)
 * - EscapeCancel: Verify cancel with Escape key
 * - CharacterCounter: Verify counter updates in real-time
 *
 * @see https://github.com/laststance/gitbox/issues/20
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
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
    onSave: async (_value, _options) => {},
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
          onSave={async (value, options) => {
            await new Promise((resolve) => setTimeout(resolve, 300))
            setSavedValue(value)
            // Only close if explicitly requested (manual save)
            if (options.closeOnSave) {
              setIsEditing(false)
            }
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
 * Custom max length (100 characters)
 */
export const CustomMaxLength: Story = {
  args: {
    initialValue: 'Short limit example',
    maxLength: 100,
    onSave: async (value, options) => {
      console.log('Saved:', value, 'closeOnSave:', options.closeOnSave)
    },
    onCancel: () => console.log('Cancelled'),
  },
}

// ============================================================================
// Interaction Tests (play functions)
// ============================================================================

/**
 * Test: Continuous typing without losing focus
 *
 * Verifies that the user can type continuously without the textarea
 * losing focus or the edit mode closing unexpectedly.
 */
export const TestTypeText: Story = {
  args: {
    initialValue: '',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')

    await step('Type text into textarea', async () => {
      await userEvent.type(
        textarea,
        'Testing continuous typing without losing focus',
      )
    })

    await step('Verify textarea still has focus', async () => {
      expect(textarea).toHaveFocus()
    })

    await step('Verify text was entered correctly', async () => {
      expect(textarea).toHaveValue(
        'Testing continuous typing without losing focus',
      )
    })

    await step('Verify character counter updated', async () => {
      await waitFor(() => {
        const counter = canvas.getByTestId('character-counter')
        expect(counter).toHaveTextContent('46/300')
      })
    })
  },
}

/**
 * Test: onBlur auto-save behavior
 *
 * Verifies that when the textarea loses focus (by clicking elsewhere),
 * the onSave callback is called with closeOnSave: false.
 * This keeps the edit mode open while saving the content.
 */
export const TestOnBlurAutoSave: Story = {
  args: {
    initialValue: '',
    onSave: fn(),
    onCancel: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[320px] p-4 bg-card rounded-lg border">
        <Story />
        {/* External element to click for blur */}
        <button
          type="button"
          data-testid="external-button"
          className="mt-4 px-4 py-2 border rounded"
        >
          Click me to trigger blur
        </button>
      </div>
    ),
  ],
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')
    const externalButton = canvas.getByTestId('external-button')

    await step('Type text into textarea', async () => {
      await userEvent.type(textarea, 'Auto-save test comment')
    })

    await step('Click external element to trigger blur', async () => {
      await userEvent.click(externalButton)
    })

    await step('Verify onSave was called with closeOnSave: false', async () => {
      await waitFor(() => {
        expect(args.onSave).toHaveBeenCalledWith('Auto-save test comment', {
          closeOnSave: false,
        })
      })
    })

    await step('Verify onCancel was NOT called', async () => {
      expect(args.onCancel).not.toHaveBeenCalled()
    })
  },
}

/**
 * Test: Enter key manual save
 *
 * Verifies that pressing Enter triggers onSave with closeOnSave: true,
 * which should close the edit mode after saving.
 */
export const TestEnterKeyManualSave: Story = {
  args: {
    initialValue: '',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')

    await step('Type text into textarea', async () => {
      await userEvent.type(textarea, 'Manual save with Enter')
    })

    await step('Press Enter key to save', async () => {
      await userEvent.keyboard('{Enter}')
    })

    await step('Verify onSave was called with closeOnSave: true', async () => {
      await waitFor(() => {
        expect(args.onSave).toHaveBeenCalledWith('Manual save with Enter', {
          closeOnSave: true,
        })
      })
    })
  },
}

/**
 * Test: Shift+Enter allows multiline input
 *
 * Verifies that Shift+Enter inserts a newline instead of saving.
 */
export const TestShiftEnterNewline: Story = {
  args: {
    initialValue: '',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')

    await step('Type first line', async () => {
      await userEvent.type(textarea, 'Line 1')
    })

    await step('Press Shift+Enter for newline', async () => {
      await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    })

    await step('Type second line', async () => {
      await userEvent.type(textarea, 'Line 2')
    })

    await step('Verify textarea contains newline', async () => {
      expect(textarea).toHaveValue('Line 1\nLine 2')
    })

    await step('Verify onSave was NOT called', async () => {
      expect(args.onSave).not.toHaveBeenCalled()
    })
  },
}

/**
 * Test: Escape key cancels editing
 *
 * Verifies that pressing Escape triggers onCancel callback.
 */
export const TestEscapeCancel: Story = {
  args: {
    initialValue: 'Original comment',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')

    await step('Type some changes', async () => {
      await userEvent.type(textarea, ' with changes')
    })

    await step('Press Escape to cancel', async () => {
      await userEvent.keyboard('{Escape}')
    })

    await step('Verify onCancel was called', async () => {
      expect(args.onCancel).toHaveBeenCalled()
    })
  },
}

/**
 * Test: Character counter updates in real-time
 *
 * Verifies that the character counter reflects the current length
 * as the user types.
 */
export const TestCharacterCounter: Story = {
  args: {
    initialValue: '',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')

    await step('Verify initial counter shows 0/300', async () => {
      const counter = canvas.getByTestId('character-counter')
      expect(counter).toHaveTextContent('0/300')
    })

    await step('Type 10 characters', async () => {
      await userEvent.type(textarea, '1234567890')
    })

    await step('Verify counter shows 10/300', async () => {
      const counter = canvas.getByTestId('character-counter')
      expect(counter).toHaveTextContent('10/300')
    })
  },
}

/**
 * Test: Warning state at 270+ characters
 *
 * Verifies that the character counter shows warning styling
 * when approaching the limit (> 270 characters).
 */
export const TestWarningThreshold: Story = {
  args: {
    initialValue: 'A'.repeat(270),
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('Verify counter shows warning style', async () => {
      const counter = canvas.getByTestId('character-counter')
      expect(counter).toHaveTextContent('270/300')
      // Warning class should be applied (text-orange-500)
      expect(counter).toHaveClass('text-orange-500')
    })
  },
}

/**
 * Test: Over limit state at 300+ characters
 *
 * Verifies that the save button is disabled when over the character limit.
 */
export const TestOverLimitDisabled: Story = {
  args: {
    initialValue: 'A'.repeat(301),
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('Verify counter shows error style', async () => {
      const counter = canvas.getByTestId('character-counter')
      expect(counter).toHaveTextContent('301/300')
      // Error class should be applied (text-destructive)
      expect(counter).toHaveClass('text-destructive')
    })

    await step('Verify save button is disabled', async () => {
      const saveButton = canvas.getByTestId('comment-save-btn')
      expect(saveButton).toBeDisabled()
    })
  },
}

/**
 * Test: Cancel button closes edit mode
 *
 * Verifies that clicking the X button triggers onCancel.
 */
export const TestCancelButton: Story = {
  args: {
    initialValue: 'Test comment',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)

    await step('Click cancel button', async () => {
      const cancelButton = canvas.getByTestId('comment-cancel-btn')
      await userEvent.click(cancelButton)
    })

    await step('Verify onCancel was called', async () => {
      expect(args.onCancel).toHaveBeenCalled()
    })

    await step('Verify onSave was NOT called', async () => {
      // Cancel button should skip onBlur save due to relatedTarget check
      expect(args.onSave).not.toHaveBeenCalled()
    })
  },
}

/**
 * Test: Save button triggers manual save
 *
 * Verifies that clicking the checkmark button triggers onSave
 * with closeOnSave: true.
 */
export const TestSaveButton: Story = {
  args: {
    initialValue: '',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')

    await step('Type a comment', async () => {
      await userEvent.type(textarea, 'Save button test')
    })

    await step('Click save button', async () => {
      const saveButton = canvas.getByTestId('comment-save-btn')
      await userEvent.click(saveButton)
    })

    await step('Verify onSave was called with closeOnSave: true', async () => {
      await waitFor(() => {
        expect(args.onSave).toHaveBeenCalledWith('Save button test', {
          closeOnSave: true,
        })
      })
    })
  },
}

/**
 * Test: No save when value unchanged
 *
 * Verifies that clicking elsewhere doesn't call onSave
 * if the value hasn't changed from initialValue.
 */
export const TestNoSaveWhenUnchanged: Story = {
  args: {
    initialValue: 'Existing comment',
    onSave: fn(),
    onCancel: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[320px] p-4 bg-card rounded-lg border">
        <Story />
        <button
          type="button"
          data-testid="external-button"
          className="mt-4 px-4 py-2 border rounded"
        >
          Click me
        </button>
      </div>
    ),
  ],
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement)
    const externalButton = canvas.getByTestId('external-button')

    await step('Click external button without making changes', async () => {
      await userEvent.click(externalButton)
    })

    await step('Verify onSave was NOT called', async () => {
      // Small delay to ensure async operations complete
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(args.onSave).not.toHaveBeenCalled()
    })
  },
}

/**
 * Test: Japanese input support
 *
 * Verifies that Japanese characters are properly handled.
 */
export const TestJapaneseInput: Story = {
  args: {
    initialValue: '',
    onSave: fn(),
    onCancel: fn(),
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByTestId('comment-textarea')

    await step('Type Japanese text', async () => {
      await userEvent.type(textarea, 'テストコメント日本語入力')
    })

    await step('Verify text was entered correctly', async () => {
      expect(textarea).toHaveValue('テストコメント日本語入力')
    })

    await step('Verify counter shows correct character count', async () => {
      const counter = canvas.getByTestId('character-counter')
      // 12 Japanese characters
      expect(counter).toHaveTextContent('12/300')
    })
  },
}

/**
 * Textarea Component Stories
 *
 * A styled textarea component for multi-line text input.
 * Supports all standard HTML textarea attributes.
 * Includes proper focus states, disabled states, and placeholder styling.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Label } from './label'
import { Textarea } from './textarea'

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Enter your message...',
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 w-[350px]">
      <Label htmlFor="textarea">Description</Label>
      <Textarea id="textarea" placeholder="Enter description..." rows={4} />
    </div>
  ),
}

export const WithValue: Story = {
  args: {
    defaultValue: 'This is a pre-filled textarea with some content.',
    rows: 4,
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled textarea',
    defaultValue: 'Cannot edit this content',
  },
}

export const LongContent: Story = {
  args: {
    defaultValue:
      'This is a longer textarea with multiple lines of content. It demonstrates how the textarea handles longer text input and maintains proper styling.',
    rows: 6,
  },
}

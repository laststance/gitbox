/**
 * Input Component Stories
 *
 * A styled input component for text input fields.
 * Supports all standard HTML input attributes and types.
 * Includes proper focus states, disabled states, and placeholder styling.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Input } from './input'
import { Label } from './label'

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
}

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2 w-[350px]">
      <Label htmlFor="input">Email</Label>
      <Input id="input" type="email" placeholder="name@example.com" />
    </div>
  ),
}

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled input',
    defaultValue: 'Cannot edit',
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: 'Pre-filled value',
  },
}

/**
 * Label Component Stories
 *
 * A styled label component built on Radix UI Label primitive.
 * Provides accessible labels for form inputs with proper association.
 * Automatically handles disabled state styling when associated with disabled inputs.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Input } from './input'
import { Label } from './label'

const meta = {
  title: 'UI/Label',
  component: Label,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Label',
  },
}

export const WithInput: Story = {
  render: () => (
    <div className="space-y-2 w-[350px]">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="name@example.com" />
    </div>
  ),
}

export const Required: Story = {
  render: () => (
    <div className="space-y-2 w-[350px]">
      <Label htmlFor="required">
        Required Field <span className="text-destructive">*</span>
      </Label>
      <Input id="required" type="text" placeholder="Required input" />
    </div>
  ),
}

export const WithDisabledInput: Story = {
  render: () => (
    <div className="space-y-2 w-[350px]">
      <Label htmlFor="disabled">Disabled Input</Label>
      <Input id="disabled" type="text" disabled placeholder="Cannot edit" />
    </div>
  ),
}

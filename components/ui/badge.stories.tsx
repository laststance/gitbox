/**
 * Badge Component Stories
 *
 * A small badge component for displaying labels, tags, or status indicators.
 * Supports multiple variants (default, secondary, destructive, outline)
 * with proper styling and hover states.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Badge } from './badge'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'Badge',
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Error',
  },
}

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
}

export const WithText: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge>New</Badge>
      <Badge variant="secondary">Updated</Badge>
      <Badge variant="destructive">Deleted</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  ),
}

export const RepositoryTags: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>TypeScript</Badge>
      <Badge variant="secondary">React</Badge>
      <Badge variant="outline">Next.js</Badge>
      <Badge>100 stars</Badge>
    </div>
  ),
}

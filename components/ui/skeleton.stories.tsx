/**
 * Skeleton Component Stories
 *
 * A skeleton loading component for displaying placeholder content while data is loading.
 * Uses pulse animation to indicate loading state. Can be customized with different sizes
 * and shapes to match the content being loaded.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Skeleton } from './skeleton'

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    className: 'h-4 w-[250px]',
  },
}

export const Circle: Story = {
  args: {
    className: 'h-12 w-12 rounded-full',
  },
}

export const Rectangle: Story = {
  args: {
    className: 'h-20 w-[300px]',
  },
}

export const CardSkeleton: Story = {
  render: () => (
    <div className="flex items-center space-x-4 w-[350px]">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  ),
}

export const TextSkeleton: Story = {
  render: () => (
    <div className="space-y-2 w-[350px]">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  ),
}

export const CardLayout: Story = {
  render: () => (
    <div className="space-y-4 w-[350px]">
      <Skeleton className="h-[200px] w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  ),
}

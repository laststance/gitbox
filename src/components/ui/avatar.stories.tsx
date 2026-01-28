/**
 * Avatar Component Stories
 *
 * An avatar component built on Radix UI Avatar primitive.
 * Displays user profile images with fallback support.
 * Includes subcomponents: AvatarImage and AvatarFallback.
 * Supports custom sizing and styling.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Avatar, AvatarFallback, AvatarImage } from './avatar'

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://avatars.githubusercontent.com/u/1?v=4" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
}

export const WithFallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://invalid-url.com/avatar.png" />
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  ),
}

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>OC</AvatarFallback>
    </Avatar>
  ),
}

export const Large: Story = {
  render: () => (
    <Avatar className="h-16 w-16">
      <AvatarImage src="https://avatars.githubusercontent.com/u/1?v=4" />
      <AvatarFallback className="text-lg">JD</AvatarFallback>
    </Avatar>
  ),
}

export const Small: Story = {
  render: () => (
    <Avatar className="h-6 w-6">
      <AvatarImage src="https://avatars.githubusercontent.com/u/1?v=4" />
      <AvatarFallback className="text-xs">JD</AvatarFallback>
    </Avatar>
  ),
}

export const Multiple: Story = {
  render: () => (
    <div className="flex gap-2">
      <Avatar>
        <AvatarImage src="https://avatars.githubusercontent.com/u/1?v=4" />
        <AvatarFallback>U1</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://avatars.githubusercontent.com/u/2?v=4" />
        <AvatarFallback>U2</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>U3</AvatarFallback>
      </Avatar>
    </div>
  ),
}

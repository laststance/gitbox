/**
 * OverflowMenu Component Stories
 *
 * A dropdown menu component for repository card actions.
 * Provides context-specific actions for Board and Maintenance modes.
 * Includes actions like opening GitHub, production URLs, tracking dashboards,
 * Supabase dashboards, editing project info, and moving/restoring cards.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { toRepoCardId } from '@/lib/types/brands'

import { OverflowMenu } from './OverflowMenu'

const meta = {
  title: 'Board/OverflowMenu',
  component: OverflowMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OverflowMenu>

export default meta
type Story = StoryObj<typeof meta>

export const BoardContext: Story = {
  args: {
    cardId: toRepoCardId('card-1'),
    repoOwner: 'octocat',
    repoName: 'example-repo',
    productionUrl: 'https://example.com',
    trackingUrl: 'https://tracking.example.com',
    supabaseUrl: 'https://supabase.example.com',
    context: 'board',
    onMoveToMaintenance: (id) => console.log('Move to maintenance:', id),
    onRemove: (id) => console.log('Remove from board:', id),
  },
}

export const MaintenanceContext: Story = {
  args: {
    cardId: toRepoCardId('card-2'),
    repoOwner: 'octocat',
    repoName: 'example-repo',
    context: 'maintenance',
    onRestoreToBoard: (id) => console.log('Restore to board:', id),
  },
}

export const Minimal: Story = {
  args: {
    cardId: toRepoCardId('card-3'),
    repoOwner: 'octocat',
    repoName: 'example-repo',
    context: 'board',
  },
}

export const WithAllUrls: Story = {
  args: {
    cardId: toRepoCardId('card-4'),
    repoOwner: 'octocat',
    repoName: 'example-repo',
    productionUrl: 'https://production.example.com',
    trackingUrl: 'https://tracking.example.com',
    supabaseUrl: 'https://supabase.example.com',
    context: 'board',
    onMoveToMaintenance: (id) => console.log('Move to maintenance:', id),
    onRemove: (id) => console.log('Remove from board:', id),
  },
}

/**
 * Demonstrates the remove from board feature with confirmation dialog.
 * This story shows the destructive action styling and AlertDialog.
 */
export const WithRemoveAction: Story = {
  args: {
    cardId: toRepoCardId('card-5'),
    repoOwner: 'laststance',
    repoName: 'gitbox',
    context: 'board',
    onRemove: (id) => console.log('Remove from board:', id),
  },
}

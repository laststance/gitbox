/**
 * OverflowMenu Component Stories
 *
 * A dropdown menu component for repository card actions.
 * Provides context-specific actions for Board and Maintenance modes.
 * Includes actions like opening GitHub, production URLs, tracking dashboards,
 * Supabase dashboards, editing project info, and moving/restoring cards.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

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
    cardId: 'card-1',
    repoOwner: 'octocat',
    repoName: 'example-repo',
    productionUrl: 'https://example.com',
    trackingUrl: 'https://tracking.example.com',
    supabaseUrl: 'https://supabase.example.com',
    context: 'board',
    onEdit: (id) => console.log('Edit:', id),
    onMoveToMaintenance: (id) => console.log('Move to maintenance:', id),
  },
}

export const MaintenanceContext: Story = {
  args: {
    cardId: 'card-2',
    repoOwner: 'octocat',
    repoName: 'example-repo',
    context: 'maintenance',
    onEdit: (id) => console.log('Edit:', id),
    onRestoreToBoard: (id) => console.log('Restore to board:', id),
  },
}

export const Minimal: Story = {
  args: {
    cardId: 'card-3',
    repoOwner: 'octocat',
    repoName: 'example-repo',
    context: 'board',
  },
}

export const WithAllUrls: Story = {
  args: {
    cardId: 'card-4',
    repoOwner: 'octocat',
    repoName: 'example-repo',
    productionUrl: 'https://production.example.com',
    trackingUrl: 'https://tracking.example.com',
    supabaseUrl: 'https://supabase.example.com',
    context: 'board',
    onEdit: (id) => console.log('Edit:', id),
    onMoveToMaintenance: (id) => console.log('Move to maintenance:', id),
  },
}

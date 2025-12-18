/**
 * MaintenanceClient Component Stories
 *
 * A client component for the Maintenance Mode page.
 * Displays completed or archived repositories in grid or list view.
 * Features search functionality, sorting options, and repository actions
 * (open on GitHub, restore to board, etc.).
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { MaintenanceClient } from './MaintenanceClient'

const meta = {
  title: 'Pages/MaintenanceClient',
  component: MaintenanceClient,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MaintenanceClient>

export default meta
type Story = StoryObj<typeof meta>

const mockRepos = [
  {
    id: 'repo-1',
    repo_owner: 'octocat',
    repo_name: 'example-repo',
    note: 'Completed project',
    meta: {
      stars: 100,
      language: 'TypeScript',
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    board: {
      name: 'My Board',
    },
  },
  {
    id: 'repo-2',
    repo_owner: 'octocat',
    repo_name: 'another-repo',
    note: null,
    meta: {
      stars: 200,
      language: 'JavaScript',
      lastUpdated: '2024-01-20T15:30:00Z',
    },
    created_at: '2023-06-15T00:00:00Z',
    updated_at: '2024-01-20T15:30:00Z',
    board: null,
  },
]

export const Default: Story = {
  args: {
    repos: mockRepos,
  },
}

export const Empty: Story = {
  args: {
    repos: [],
  },
}

export const ManyRepos: Story = {
  args: {
    repos: Array.from({ length: 20 }, (_, i) => ({
      id: `repo-${i}`,
      repo_owner: 'octocat',
      repo_name: `repo-${i}`,
      note: i % 2 === 0 ? `Note for repo ${i}` : null,
      meta: {
        stars: i * 10,
        language: i % 2 === 0 ? 'TypeScript' : 'JavaScript',
        lastUpdated: new Date(2024, 0, i + 1).toISOString(),
      },
      created_at: new Date(2023, 0, i + 1).toISOString(),
      updated_at: new Date(2024, 0, i + 1).toISOString(),
      board: i % 3 === 0 ? { name: `Board ${i}` } : null,
    })),
  },
}

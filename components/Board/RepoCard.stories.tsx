/**
 * RepoCard Component Stories
 *
 * A draggable card component representing a GitHub repository in the Kanban board.
 * Displays repository information including title, description, tags, assignee,
 * and metadata (due date, comments, attachments). Supports drag-and-drop via
 * @dnd-kit/sortable and keyboard navigation for accessibility.
 */

import { DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'


import { RepoCard } from './RepoCard'

const meta = {
  title: 'Board/RepoCard',
  component: RepoCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DndContext>
        <div className="w-[300px]">
          <Story />
        </div>
      </DndContext>
    ),
  ],
} satisfies Meta<typeof RepoCard>

export default meta
type Story = StoryObj<typeof meta>

const mockCard = {
  id: '1',
  title: 'example-repo',
  description: 'An example repository for testing purposes',
  priority: 'medium' as const,
  assignee: {
    name: 'octocat',
    avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
  },
  tags: ['TypeScript', 'React', 'Next.js'],
  dueDate: '2024-12-31',
  attachments: 3,
  comments: 5,
  statusId: 'status-1',
  repoOwner: 'octocat',
  repoName: 'example-repo',
}

export const Default: Story = {
  args: {
    card: mockCard,
  },
}

export const WithoutDescription: Story = {
  args: {
    card: {
      ...mockCard,
      description: undefined,
    },
  },
}

export const WithoutTags: Story = {
  args: {
    card: {
      ...mockCard,
      tags: undefined,
    },
  },
}

export const WithoutAssignee: Story = {
  args: {
    card: {
      ...mockCard,
      assignee: undefined,
    },
  },
}

export const Minimal: Story = {
  args: {
    card: {
      id: '2',
      title: 'minimal-repo',
      statusId: 'status-1',
      repoOwner: 'octocat',
      repoName: 'minimal-repo',
    },
  },
}

export const WithAllMetadata: Story = {
  args: {
    card: {
      ...mockCard,
      priority: 'high' as const,
      dueDate: '2024-12-25',
      attachments: 10,
      comments: 20,
    },
  },
}

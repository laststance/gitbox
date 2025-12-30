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

/**
 * With inline comment displayed (Phase 3: Comment Display)
 */
export const WithComment: Story = {
  args: {
    card: mockCard,
    comment: 'npmリリース完了、当分は機能追加予定なし',
  },
}

/**
 * With long comment that spans multiple lines
 */
export const WithLongComment: Story = {
  args: {
    card: mockCard,
    comment:
      'プロトタイプ作ったけど微妙、差分表示エディタで苦戦中。リファクタリング予定あり。チームでレビュー待ち。',
  },
}

/**
 * With empty comment (shows "Add comment" placeholder)
 */
export const WithEmptyComment: Story = {
  args: {
    card: mockCard,
    comment: '',
    showComment: true,
  },
}

/**
 * Comment hidden (showComment = false)
 */
export const CommentHidden: Story = {
  args: {
    card: mockCard,
    comment: 'This comment should not be visible',
    showComment: false,
  },
}

/**
 * With custom comment style
 */
export const WithStyledComment: Story = {
  args: {
    card: mockCard,
    comment: '重要：来週リリース予定',
    commentStyle: {
      borderColor: 'blue',
      backgroundColor: 'tinted',
      fontSize: 'base',
      fontWeight: 'semibold',
    },
  },
}

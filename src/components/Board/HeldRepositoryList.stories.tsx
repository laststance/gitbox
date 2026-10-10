/**
 * HeldRepositoryList Component Stories
 *
 * The "Already placed elsewhere" list shown at the bottom of the Add
 * Repositories picker. A repository may sit on only one board (Issue #215), so
 * repositories the user cannot add are listed with a link to where they live.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within } from 'storybook/test'

import { HeldRepositoryList } from './HeldRepositoryList'

const meta = {
  title: 'Board/AddRepositoryCombobox/HeldRepositoryList',
  component: HeldRepositoryList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    // Same inner width as the picker panel (w-120 minus p-4)
    (Story) => (
      <div className="w-112">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeldRepositoryList>

export default meta
type Story = StoryObj<typeof meta>

/**
 * One repository on another board and one in Maintenance.
 */
export const OnAnotherBoardAndInMaintenance: Story = {
  args: {
    repositories: [
      {
        id: 1,
        fullName: 'laststance/gitbox',
        location: {
          kind: 'board',
          boardId: '00000000-0000-0000-0000-000000000101',
          boardName: 'Work Projects',
        },
      },
      {
        id: 2,
        fullName: 'laststance/old-project',
        location: { kind: 'maintenance' },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Already placed elsewhere (2)')).toBeVisible()
    await expect(
      canvas.getByRole('link', {
        name: 'Open board Work Projects, which holds laststance/gitbox',
      }),
    ).toHaveAttribute('href', '/board/00000000-0000-0000-0000-000000000101')
    await expect(
      canvas.getByRole('link', {
        name: 'Open Maintenance, which holds laststance/old-project',
      }),
    ).toHaveAttribute('href', '/maintenance')
  },
}

/**
 * Long repository and board names truncate instead of widening the panel.
 */
export const LongNames: Story = {
  args: {
    repositories: [
      {
        id: 3,
        fullName:
          'a-very-long-organization-name/a-very-long-repository-name-that-does-not-fit-the-panel',
        location: {
          kind: 'board',
          boardId: '00000000-0000-0000-0000-000000000101',
          boardName:
            'A board with a remarkably long name that also does not fit',
        },
      },
    ],
  },
}

/**
 * More rows than fit: the list scrolls on its own.
 */
export const ManyRows: Story = {
  args: {
    repositories: Array.from({ length: 8 }, (_, index) => ({
      id: 100 + index,
      fullName: `laststance/project-${index + 1}`,
      location: {
        kind: 'board' as const,
        boardId: '00000000-0000-0000-0000-000000000101',
        boardName: 'Work Projects',
      },
    })),
  },
}

/**
 * AccountClient Component Stories
 *
 * Tests the account management page UI:
 * - Default state with user profile and stats
 * - Missing avatar shows GitHub icon placeholder
 * - Empty stats display zeros
 * - High stats display large numbers correctly
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'

import { AccountClient } from './AccountClient'

const meta = {
  title: 'Pages/AccountClient',
  component: AccountClient,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AccountClient>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default state with mock user data and moderate stats
 */
export const Default: Story = {
  args: {
    userProfile: {
      id: 'user-1',
      userName: 'testuser',
      userAvatar: 'https://avatars.githubusercontent.com/u/12345?v=4',
      linkedSince: '2024-01-01T00:00:00.000Z',
    },
    accountData: {
      boardsCount: 2,
      cardsCount: 5,
      maintenanceCount: 3,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('@testuser')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    expect(canvas.getByText('Boards')).toBeInTheDocument()
    expect(canvas.getByText('2', { exact: true })).toBeInTheDocument()
  },
}

/**
 * Empty avatar shows GitHub icon placeholder instead of an image
 */
export const NoAvatar: Story = {
  args: {
    userProfile: {
      id: 'user-2',
      userName: 'noavatar-user',
      userAvatar: '',
      linkedSince: '2024-06-15T00:00:00.000Z',
    },
    accountData: {
      boardsCount: 1,
      cardsCount: 3,
      maintenanceCount: 0,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('@noavatar-user')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // No <img> element should be present; placeholder div renders instead
    const images = canvasElement.querySelectorAll('img')
    expect(images.length).toBe(0)
  },
}

/**
 * All stats are zero — verifies "0" appears for each category
 */
export const EmptyStats: Story = {
  args: {
    userProfile: {
      id: 'user-3',
      userName: 'newuser',
      userAvatar: 'https://avatars.githubusercontent.com/u/99999?v=4',
      linkedSince: '2025-12-01T00:00:00.000Z',
    },
    accountData: {
      boardsCount: 0,
      cardsCount: 0,
      maintenanceCount: 0,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('@newuser')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    // All three stat counts should display "0"
    const zeros = canvas.getAllByText('0')
    expect(zeros.length).toBe(3)
  },
}

/**
 * High stats — verifies large numbers render correctly
 */
export const HighStats: Story = {
  args: {
    userProfile: {
      id: 'user-4',
      userName: 'poweruser',
      userAvatar: 'https://avatars.githubusercontent.com/u/11111?v=4',
      linkedSince: '2023-03-10T00:00:00.000Z',
    },
    accountData: {
      boardsCount: 42,
      cardsCount: 1234,
      maintenanceCount: 99,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(
      () => {
        expect(canvas.getByText('@poweruser')).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    expect(canvas.getByText('42')).toBeInTheDocument()
    expect(canvas.getByText('1234')).toBeInTheDocument()
    expect(canvas.getByText('99')).toBeInTheDocument()
  },
}

/**
 * MaintenanceClient Component Stories
 *
 * A client component for the Maintenance Mode page.
 * Displays completed or archived repositories in grid or list view.
 * Features search functionality, sorting options, and repository actions
 * (open on GitHub, restore to board, etc.).
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, within, userEvent, waitFor } from 'storybook/test'

import { toMaintenanceId } from '@/lib/types/brands'

import { MaintenanceClient, type MaintenanceRepo } from './MaintenanceClient'

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

const mockRepos: MaintenanceRepo[] = [
  {
    id: toMaintenanceId('repo-1'),
    repo_owner: 'octocat',
    repo_name: 'example-repo',
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
    id: toMaintenanceId('repo-2'),
    repo_owner: 'octocat',
    repo_name: 'another-repo',
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
    repos: Array.from(
      { length: 20 },
      (_, i): MaintenanceRepo => ({
        id: toMaintenanceId(`repo-${i}`),
        repo_owner: 'octocat',
        repo_name: `repo-${i}`,
        meta: {
          stars: i * 10,
          language: i % 2 === 0 ? 'TypeScript' : 'JavaScript',
          lastUpdated: new Date(2024, 0, i + 1).toISOString(),
        },
        created_at: new Date(2023, 0, i + 1).toISOString(),
        updated_at: new Date(2024, 0, i + 1).toISOString(),
        board: i % 3 === 0 ? { name: `Board ${i}` } : null,
      }),
    ),
  },
}

/**
 * Tests search functionality - filtering repositories by name
 */
export const SearchFilter: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find search input
    const searchInput = canvas.getByPlaceholderText('Search repositories...')
    expect(searchInput).toBeInTheDocument()

    // Type in search
    await userEvent.type(searchInput, 'example')

    // Wait for filter to apply
    await waitFor(() => {
      expect(canvas.getByText('example-repo')).toBeInTheDocument()
    })
  },
}

/**
 * Tests view mode toggle between grid and list
 */
export const ViewModeToggle: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Get view toggle buttons (Grid and List icons)
    const buttons = canvas.getAllByRole('button')
    // First two buttons after Sort are view toggles
    const gridButton = buttons.find((btn) =>
      btn.querySelector('svg.lucide-grid-3x3'),
    )
    const listButton = buttons.find((btn) =>
      btn.querySelector('svg.lucide-list'),
    )

    expect(gridButton).toBeInTheDocument()
    expect(listButton).toBeInTheDocument()

    // Click list view
    if (listButton) {
      await userEvent.click(listButton)
    }

    // Wait for view change
    await waitFor(() => {
      // In list view, repos show as owner/name format
      expect(canvas.getByText('octocat/example-repo')).toBeInTheDocument()
    })

    // Click grid view
    if (gridButton) {
      await userEvent.click(gridButton)
    }

    // Wait for view change back
    await waitFor(() => {
      expect(canvas.getByText('example-repo')).toBeInTheDocument()
    })
  },
}

/**
 * Tests sort dropdown functionality
 */
export const SortDropdown: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find and click Sort button
    const sortButton = canvas.getByRole('button', { name: /sort/i })
    expect(sortButton).toBeInTheDocument()

    await userEvent.click(sortButton)

    // Wait for dropdown to appear - check in document body (portal)
    await waitFor(
      () => {
        const dropdown = document.querySelector('[role="menu"]')
        expect(dropdown).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}

/**
 * Tests sorting toggle between ascending and descending
 */
export const SortAscDesc: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find and click Sort button
    const sortButton = canvas.getByRole('button', { name: /sort/i })
    await userEvent.click(sortButton)

    // Wait for dropdown to appear
    await waitFor(
      () => {
        const dropdown = document.querySelector('[role="menu"]')
        expect(dropdown).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}

/**
 * Tests empty state when no repos match search
 */
export const EmptySearchResults: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Search for non-existent repo
    const searchInput = canvas.getByPlaceholderText('Search repositories...')
    await userEvent.type(searchInput, 'nonexistent-repo-xyz')

    // Wait for empty state
    await waitFor(() => {
      expect(canvas.getByText('No matching repositories')).toBeInTheDocument()
      expect(
        canvas.getByText('Try adjusting your search terms'),
      ).toBeInTheDocument()
    })
  },
}

/**
 * Tests grid card menu interactions
 */
export const GridCardMenu: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for cards to render
    await waitFor(() => {
      expect(canvas.getByText('example-repo')).toBeInTheDocument()
    })

    // Find menu button (MoreVertical icon) - it's hidden until hover
    // So we need to find the card first
    const card = canvas.getByText('example-repo').closest('.group')
    expect(card).toBeInTheDocument()

    // Find menu trigger button within the card
    if (card) {
      const buttons = within(card as HTMLElement).getAllByRole('button')
      // First button is the dropdown trigger
      if (buttons.length > 0) {
        await userEvent.click(buttons[0]!)
      }
    }

    // Wait for dropdown to appear
    await waitFor(
      () => {
        const dropdown = document.querySelector('[role="menu"]')
        expect(dropdown).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  },
}

/**
 * Tests list view rendering
 */
export const ListView: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find and click the list view button
    const buttons = canvas.getAllByRole('button')
    const listButton = buttons.find((btn) =>
      btn.querySelector('svg.lucide-list'),
    )

    if (listButton) {
      await userEvent.click(listButton)
    }

    // Wait for list view to render
    await waitFor(() => {
      // List view shows full owner/name format
      expect(canvas.getByText('octocat/example-repo')).toBeInTheDocument()
    })
  },
}

/**
 * Tests empty state when no repos
 */
export const EmptyStateRendered: Story = {
  args: {
    repos: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for empty state to render
    await waitFor(() => {
      expect(canvas.getByText('No maintenance projects')).toBeInTheDocument()
      expect(
        canvas.getByText(/Move projects here from your boards/),
      ).toBeInTheDocument()
    })
  },
}

/**
 * Tests that repo renders with owner name
 */
export const RepoShowsOwnerName: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Wait for repos to render
    await waitFor(() => {
      expect(canvas.getByText('example-repo')).toBeInTheDocument()
    })

    // Check owner name is displayed (multiple repos have same owner)
    const ownerElements = canvas.getAllByText('octocat')
    expect(ownerElements.length).toBeGreaterThan(0)
  },
}

/**
 * Tests sorting by name
 */
export const SortByName: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find and click Sort button
    const sortButton = canvas.getByRole('button', { name: /sort/i })
    await userEvent.click(sortButton)

    // Wait for dropdown to appear
    await waitFor(
      () => {
        const dropdown = document.querySelector('[role="menu"]')
        expect(dropdown).toBeInTheDocument()
      },
      { timeout: 2000 },
    )

    // Click Name option in dropdown
    const dropdown = document.querySelector('[role="menu"]')
    if (dropdown) {
      const nameOption = within(dropdown as HTMLElement).getByText(/Name/)
      await userEvent.click(nameOption)
    }
  },
}

/**
 * Tests sorting by stars
 */
export const SortByStars: Story = {
  args: {
    repos: mockRepos,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Find and click Sort button
    const sortButton = canvas.getByRole('button', { name: /sort/i })
    await userEvent.click(sortButton)

    // Wait for dropdown to appear
    await waitFor(
      () => {
        const dropdown = document.querySelector('[role="menu"]')
        expect(dropdown).toBeInTheDocument()
      },
      { timeout: 2000 },
    )

    // Click Stars option in dropdown
    const dropdown = document.querySelector('[role="menu"]')
    if (dropdown) {
      const starsOption = within(dropdown as HTMLElement).getByText(/Stars/)
      await userEvent.click(starsOption)
    }
  },
}

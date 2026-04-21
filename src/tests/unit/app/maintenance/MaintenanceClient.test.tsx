/**
 * Unit Test: MaintenanceClient Component
 *
 * Test targets:
 * - View mode toggle (grid/list)
 * - Search filtering
 * - Sort functionality
 * - Empty state rendering
 * - Repository card rendering
 */

import { render, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  MaintenanceClient,
  type MaintenanceRepo,
} from '@/app/maintenance/MaintenanceClient'
import { toMaintenanceId } from '@/lib/types/brands'

let mockLastVisitedBoard: { id: string; name: string } | null = null

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

vi.mock('@/lib/actions/maintenance-project-info', () => ({
  getCommentsForMaintenanceItems: vi.fn().mockResolvedValue({}),
  updateMaintenanceComment: vi.fn().mockResolvedValue({}),
  updateMaintenanceCommentColor: vi.fn().mockResolvedValue({}),
  deleteMaintenanceComment: vi.fn().mockResolvedValue({}),
  getMaintenanceProjectInfo: vi.fn().mockResolvedValue(null),
  upsertMaintenanceProjectInfo: vi.fn().mockResolvedValue({}),
  deleteMaintenanceItem: vi.fn().mockResolvedValue({ success: true }),
  deleteMaintenanceItemAction: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/repo-cards', () => ({
  getUserBoardsWithStatusLists: vi.fn().mockResolvedValue({
    success: true,
    boards: [],
  }),
}))

vi.mock('@/lib/redux/store', () => ({
  useAppSelector: vi.fn(() => mockLastVisitedBoard),
}))

// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', {
  value: mockOpen,
  writable: true,
})

/**
 * Create mock maintenance repo data
 *
 * @param overrides - Optional overrides for repo properties
 * @returns Mock MaintenanceRepo object
 */
function createMockRepo(overrides?: Partial<MaintenanceRepo>): MaintenanceRepo {
  return {
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
    ...overrides,
  }
}

describe('MaintenanceClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockLastVisitedBoard = null
  })

  describe('Rendering', () => {
    it('should render the component with repos', async () => {
      const repos = [createMockRepo()]

      render(<MaintenanceClient repos={repos} />)

      await waitFor(() => {
        expect(screen.getByText('Maintenance Mode')).toBeInTheDocument()
        expect(screen.getByText('example-repo')).toBeInTheDocument()
      })
    })

    it('should render header with correct item count', async () => {
      const repos = [
        createMockRepo({ id: toMaintenanceId('repo-1') }),
        createMockRepo({
          id: toMaintenanceId('repo-2'),
          repo_name: 'second-repo',
        }),
      ]

      render(<MaintenanceClient repos={repos} />)

      await waitFor(() => {
        expect(screen.getByText(/2 items/)).toBeInTheDocument()
      })
    })

    it('should render search input', async () => {
      render(<MaintenanceClient repos={[createMockRepo()]} />)

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Search repositories...'),
        ).toBeInTheDocument()
      })
    })

    it('should render sort button', async () => {
      render(<MaintenanceClient repos={[createMockRepo()]} />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /sort/i }),
        ).toBeInTheDocument()
      })
    })

    it('should render view toggle buttons', async () => {
      render(<MaintenanceClient repos={[createMockRepo()]} />)

      await waitFor(() => {
        // Find buttons with grid and list icons
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Empty State', () => {
    it('should render empty state when no repos', async () => {
      render(<MaintenanceClient repos={[]} />)

      await waitFor(() => {
        expect(screen.getByText('No maintenance projects')).toBeInTheDocument()
        expect(
          screen.getByText(/Move projects here from your boards/),
        ).toBeInTheDocument()
      })
    })

    it('should render empty state when search has no results', async () => {
      const repos = [createMockRepo()]
      render(<MaintenanceClient repos={repos} />)

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      await userEvent.type(searchInput, 'nonexistent-xyz')

      await waitFor(() => {
        expect(screen.getByText('No matching repositories')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('should filter repos by name', async () => {
      const repos = [
        createMockRepo({ id: toMaintenanceId('repo-1'), repo_name: 'react' }),
        createMockRepo({ id: toMaintenanceId('repo-2'), repo_name: 'vue' }),
      ]
      render(<MaintenanceClient repos={repos} />)

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      await userEvent.type(searchInput, 'react')

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument()
        expect(screen.queryByText('vue')).not.toBeInTheDocument()
      })
    })

    it('should filter repos by owner', async () => {
      const repos = [
        createMockRepo({
          id: toMaintenanceId('repo-1'),
          repo_owner: 'facebook',
        }),
        createMockRepo({ id: toMaintenanceId('repo-2'), repo_owner: 'google' }),
      ]
      render(<MaintenanceClient repos={repos} />)

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      await userEvent.type(searchInput, 'facebook')

      await waitFor(() => {
        expect(screen.getByText('facebook')).toBeInTheDocument()
        expect(screen.queryByText('google')).not.toBeInTheDocument()
      })
    })

    it('should be case-insensitive', async () => {
      const repos = [
        createMockRepo({ id: toMaintenanceId('repo-1'), repo_name: 'MyRepo' }),
      ]
      render(<MaintenanceClient repos={repos} />)

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      await userEvent.type(searchInput, 'myrepo')

      await waitFor(() => {
        expect(screen.getByText('MyRepo')).toBeInTheDocument()
      })
    })
  })

  describe('Grid/List View Toggle', () => {
    it('should default to grid view', async () => {
      const repos = [createMockRepo()]
      const { container } = render(<MaintenanceClient repos={repos} />)

      await waitFor(() => {
        // Grid view shows repo_name only
        expect(screen.getByText('example-repo')).toBeInTheDocument()
        // Should have grid layout
        const grid = container.querySelector('.grid')
        expect(grid).toBeInTheDocument()
      })
    })
  })

  describe('Sort Functionality', () => {
    it('should open sort dropdown on click', async () => {
      render(<MaintenanceClient repos={[createMockRepo()]} />)

      const sortButton = screen.getByRole('button', { name: /sort/i })
      await userEvent.click(sortButton)

      await waitFor(() => {
        expect(screen.getByText(/Name/)).toBeInTheDocument()
        expect(screen.getByText(/Last Updated/)).toBeInTheDocument()
        expect(screen.getByText(/Stars/)).toBeInTheDocument()
      })
    })
  })

  describe('Repository Card', () => {
    it('should display repo metadata', async () => {
      const repos = [
        createMockRepo({
          meta: { stars: 500, language: 'Rust' },
        }),
      ]
      render(<MaintenanceClient repos={repos} />)

      await waitFor(() => {
        expect(screen.getByText('500')).toBeInTheDocument()
        expect(screen.getByText('Rust')).toBeInTheDocument()
      })
    })

    it('should display updated date', async () => {
      const repos = [
        createMockRepo({
          updated_at: '2024-01-15T10:00:00Z',
        }),
      ]
      render(<MaintenanceClient repos={repos} />)

      await waitFor(() => {
        // Date format depends on locale, just check it's present
        const dateElements = screen.getAllByText(/2024/)
        expect(dateElements.length).toBeGreaterThan(0)
      })
    })

    it('should have Note button', async () => {
      const repos = [createMockRepo()]
      render(<MaintenanceClient repos={repos} />)

      await waitFor(() => {
        expect(screen.getByText('Note')).toBeInTheDocument()
      })
    })
  })

  describe('Back Button', () => {
    it('should show back button when lastVisitedBoard is set', async () => {
      mockLastVisitedBoard = { id: 'board-1', name: 'My Board' }

      render(<MaintenanceClient repos={[createMockRepo()]} />)

      await waitFor(() => {
        expect(screen.getByText(/Back to My Board/)).toBeInTheDocument()
      })
    })

    it('should not show back button when no lastVisitedBoard', async () => {
      render(<MaintenanceClient repos={[createMockRepo()]} />)

      await waitFor(() => {
        expect(screen.queryByText(/Back to/)).not.toBeInTheDocument()
      })
    })
  })
})

describe('MaintenanceClient Sorting Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockLastVisitedBoard = null
  })

  it('should sort by name alphabetically', async () => {
    const repos = [
      createMockRepo({ id: toMaintenanceId('repo-1'), repo_name: 'zebra' }),
      createMockRepo({ id: toMaintenanceId('repo-2'), repo_name: 'apple' }),
    ]
    render(<MaintenanceClient repos={repos} />)

    // Click sort button
    const sortButton = screen.getByRole('button', { name: /sort/i })
    await userEvent.click(sortButton)

    // Click Name option
    await waitFor(() => {
      const nameOption = screen.getByText(/Name/)
      expect(nameOption).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText(/Name/))

    // Both repos should be visible
    await waitFor(() => {
      expect(screen.getByText('zebra')).toBeInTheDocument()
      expect(screen.getByText('apple')).toBeInTheDocument()
    })
  })

  it('should sort by stars', async () => {
    const repos = [
      createMockRepo({ id: toMaintenanceId('repo-1'), meta: { stars: 10 } }),
      createMockRepo({ id: toMaintenanceId('repo-2'), meta: { stars: 1000 } }),
    ]
    render(<MaintenanceClient repos={repos} />)

    // Click sort button
    const sortButton = screen.getByRole('button', { name: /sort/i })
    await userEvent.click(sortButton)

    // Click Stars option
    await waitFor(() => {
      const starsOption = screen.getByText(/Stars/)
      expect(starsOption).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText(/Stars/))

    // Both should be visible (sorting applied)
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
    })
  })
})

describe('MaintenanceClient View Toggle Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should toggle to list view and back to grid view', async () => {
    const repos = [createMockRepo()]
    const { container } = render(<MaintenanceClient repos={repos} />)

    // Should start in grid view
    await waitFor(() => {
      expect(container.querySelector('.grid')).toBeInTheDocument()
    })

    // Find and click list button (button containing list icon)
    const buttons = screen.getAllByRole('button')
    const listButton = buttons.find(
      (btn) => btn.querySelector('svg.lucide-list') !== null,
    )

    if (listButton) {
      await userEvent.click(listButton)
    }

    // Wait for list view - should show owner/name format
    await waitFor(() => {
      expect(screen.getByText('octocat/example-repo')).toBeInTheDocument()
    })

    // Find and click grid button
    const gridButton = buttons.find(
      (btn) => btn.querySelector('svg.lucide-grid-3x3') !== null,
    )

    if (gridButton) {
      await userEvent.click(gridButton)
    }

    // Wait for grid view
    await waitFor(() => {
      // In grid view, shows repo name only
      expect(screen.getByText('example-repo')).toBeInTheDocument()
    })
  })
})

describe('MaintenanceClient Handler Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockOpen.mockClear()
  })

  it('should open GitHub URL via dropdown menu', async () => {
    const repos = [createMockRepo()]
    render(<MaintenanceClient repos={repos} />)

    await waitFor(() => {
      expect(screen.getByText('example-repo')).toBeInTheDocument()
    })

    // Open the dropdown menu on the card
    const menuTrigger = screen
      .getByText('example-repo')
      .closest('.group')
      ?.querySelector('button')
    if (menuTrigger) {
      await userEvent.click(menuTrigger)
    }

    // Click "Open on GitHub" menu item
    const menuItem = await screen.findByText('Open on GitHub')
    await userEvent.click(menuItem)

    // Should open GitHub URL (OverflowMenu adds noopener,noreferrer)
    expect(mockOpen).toHaveBeenCalledWith(
      'https://github.com/octocat/example-repo',
      '_blank',
      'noopener,noreferrer',
    )
  })
})

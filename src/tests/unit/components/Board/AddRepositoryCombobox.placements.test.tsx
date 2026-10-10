/**
 * Unit Tests: Add Repositories picker and "one repository, one card per user" (Issue #215)
 *
 * Renders the real picker with a mocked GitHub catalog, mocked placements and a
 * mocked add action. Covers what the user sees for repositories that are
 * already placed elsewhere, and how the picker reacts when the server skips
 * some or all of the selection.
 *
 * @see src/components/Board/AddRepositoryCombobox.tsx
 */

import { configureStore } from '@reduxjs/toolkit'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { AddRepositoryCombobox } from '@/components/Board/AddRepositoryCombobox'
import { getUserRepoPlacements } from '@/lib/actions/board-data'
import {
  getAuthenticatedRepositoryCatalog,
  type GitHubRepository,
} from '@/lib/actions/github'
import {
  addRepositoriesToBoard,
  type CreatedRepoCard,
} from '@/lib/actions/repo-cards'
import boardReducer from '@/lib/redux/slices/boardSlice'
import settingsReducer from '@/lib/redux/slices/settingsSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

vi.mock('@/lib/actions/github', () => ({
  getAuthenticatedRepositoryCatalog: vi.fn(),
}))

vi.mock('@/lib/actions/board-data', () => ({
  getUserRepoPlacements: vi.fn(),
}))

vi.mock('@/lib/actions/repo-cards', () => ({
  addRepositoriesToBoard: vi.fn(),
}))

vi.mock('@/lib/utils/handle-github-token-missing', () => ({
  clearGitHubRefreshAttempts: vi.fn(),
  handleGitHubTokenMissing: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn() },
}))

/** A catalog repository owned by `laststance`. */
function makeRepository(id: number, name: string): GitHubRepository {
  return {
    id,
    name,
    full_name: `laststance/${name}`,
    owner: { login: 'laststance', avatar_url: '' },
    description: null,
    stargazers_count: 0,
    language: null,
    topics: [],
    visibility: 'public',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

/** The card the server returns after adding `laststance/free-repo` to board-1. */
function makeCreatedFreeRepoCard(): CreatedRepoCard {
  return {
    id: toRepoCardId('card-9'),
    boardId: toBoardId('board-1'),
    statusId: toStatusListId('status-1'),
    repoOwner: 'laststance',
    repoName: 'free-repo',
    order: 0,
    meta: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** Make the GitHub catalog return exactly these repositories. */
function mockCatalog(repositories: GitHubRepository[]): void {
  vi.mocked(getAuthenticatedRepositoryCatalog).mockResolvedValue({
    success: true,
    data: {
      currentUser: {
        id: 1,
        login: 'octocat',
        avatar_url: '',
        name: 'Octocat',
        type: 'User',
      },
      organizations: [],
      repositories,
    },
  })
}

/** Render the open picker for board-1 inside a fresh store. */
function renderOpenPicker(
  props: { maintenanceRepoIdentifiers?: string[] } = {},
) {
  const store = configureStore({
    reducer: { board: boardReducer, settings: settingsReducer },
  })
  const onOpenChange = vi.fn()
  const onRepositoriesAdded = vi.fn()
  render(
    <Provider store={store}>
      <AddRepositoryCombobox
        boardId={toBoardId('board-1')}
        statusId={toStatusListId('status-1')}
        isOpen
        onOpenChange={onOpenChange}
        onRepositoriesAdded={onRepositoriesAdded}
        maintenanceRepoIdentifiers={props.maintenanceRepoIdentifiers}
      />
    </Provider>,
  )
  return { onOpenChange, onRepositoriesAdded }
}

/**
 * Wait for the addable repositories and return their rows. Scoped to the
 * repository listbox because the visibility `<select>` also contains options.
 */
async function findRepositoryOptions(): Promise<HTMLElement[]> {
  const listbox = await screen.findByRole('listbox', {
    name: 'Repository options',
  })
  return within(listbox).getAllByRole('option')
}

describe('AddRepositoryCombobox with repositories placed elsewhere', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('lists a repository held by another board with a link to that board instead of offering it', async () => {
    // Arrange
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        boards: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
        ],
        maintenance: [],
      },
    })

    // Act
    renderOpenPicker()

    // Assert
    const heldList = await screen.findByRole('list', {
      name: 'Already placed elsewhere',
    })
    expect(screen.getByText('Already placed elsewhere (1)')).toBeVisible()
    expect(within(heldList).getByText('laststance/gitbox')).toBeVisible()
    const boardLink = within(heldList).getByRole('link', {
      name: 'Open board Work Projects, which holds laststance/gitbox',
    })
    expect(boardLink).toHaveTextContent('On Work Projects')
    expect(boardLink).toHaveAttribute('href', '/board/board-2')
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('laststance/free-repo')
  })

  test('lists a repository in Maintenance with a link to Maintenance', async () => {
    // Arrange
    mockCatalog([
      makeRepository(1, 'free-repo'),
      makeRepository(3, 'old-project'),
    ])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { boards: [], maintenance: ['laststance/old-project'] },
    })

    // Act
    renderOpenPicker()

    // Assert
    const maintenanceLink = await screen.findByRole('link', {
      name: 'Open Maintenance, which holds laststance/old-project',
    })
    expect(maintenanceLink).toHaveTextContent('In Maintenance')
    expect(maintenanceLink).toHaveAttribute('href', '/maintenance')
    expect(await findRepositoryOptions()).toHaveLength(1)
  })

  test('shows where a repository lives when the search matches only a held repository', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        boards: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
        ],
        maintenance: [],
      },
    })
    renderOpenPicker()
    await screen.findByRole('list', { name: 'Already placed elsewhere' })

    // Act
    await user.type(
      screen.getByRole('textbox', { name: 'Search repositories' }),
      'gitbox',
    )

    // Assert
    expect(
      await screen.findByText(
        'No repositories to add. The ones below are already placed.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', {
        name: 'Open board Work Projects, which holds laststance/gitbox',
      }),
    ).toBeVisible()
    expect(screen.queryByText(/No repositories found matching/)).toBeNull()
    expect(
      screen.queryByRole('listbox', { name: 'Repository options' }),
    ).toBeNull()
  })

  test('says no repositories match only when neither list has a match', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        boards: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
        ],
        maintenance: [],
      },
    })
    renderOpenPicker()
    await screen.findByRole('list', { name: 'Already placed elsewhere' })

    // Act
    await user.type(
      screen.getByRole('textbox', { name: 'Search repositories' }),
      'zzz',
    )

    // Assert
    expect(
      await screen.findByText('No repositories found matching "zzz"'),
    ).toBeVisible()
    expect(
      screen.queryByRole('list', { name: 'Already placed elsewhere' }),
    ).toBeNull()
  })

  test('keeps the picker usable without a held list when placements cannot be loaded', async () => {
    // Arrange
    mockCatalog([
      makeRepository(1, 'free-repo'),
      makeRepository(3, 'old-project'),
    ])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: false,
      error: 'An unexpected error occurred',
    })

    // Act
    renderOpenPicker({ maintenanceRepoIdentifiers: ['laststance/old-project'] })

    // Assert
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('laststance/free-repo')
    expect(
      screen.queryByRole('list', { name: 'Already placed elsewhere' }),
    ).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('keeps the picker open and explains why when every selected repository was skipped', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements)
      // On open: this picker does not know about the placement yet
      .mockResolvedValueOnce({
        success: true,
        data: { boards: [], maintenance: [] },
      })
      // Refetch after the skipped result
      .mockResolvedValue({
        success: true,
        data: {
          boards: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
            },
          ],
          maintenance: [],
        },
      })
    vi.mocked(addRepositoriesToBoard).mockResolvedValue({
      success: true,
      data: {
        addedCount: 0,
        cards: [],
        skipped: [
          {
            fullName: 'laststance/gitbox',
            reason: 'other-board',
            message: 'laststance/gitbox is already on board "Work Projects"',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
        ],
      },
    })
    const { onOpenChange, onRepositoriesAdded } = renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)

    // Act
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))

    // Assert
    const notice = await screen.findByRole('note', {
      name: 'Repositories that were not added',
    })
    expect(notice).toHaveTextContent(
      'laststance/gitbox is already on board "Work Projects"',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add (0)' })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Remove laststance/gitbox' }),
    ).toBeNull()
    expect(
      await screen.findByRole('link', {
        name: 'Open board Work Projects, which holds laststance/gitbox',
      }),
    ).toBeVisible()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(onRepositoriesAdded).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  test('shows one toast and closes when some repositories were added and some skipped', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { boards: [], maintenance: [] },
    })
    const createdCard = makeCreatedFreeRepoCard()
    vi.mocked(addRepositoriesToBoard).mockResolvedValue({
      success: true,
      data: {
        addedCount: 1,
        cards: [createdCard],
        skipped: [
          {
            fullName: 'laststance/gitbox',
            reason: 'other-board',
            message: 'laststance/gitbox is already on board "Work Projects"',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
        ],
      },
    })
    const { onOpenChange, onRepositoriesAdded } = renderOpenPicker()
    const options = await findRepositoryOptions()
    await user.click(options[0]!)
    await user.click(options[1]!)

    // Act
    await user.click(screen.getByRole('button', { name: 'Add (2)' }))

    // Assert
    await vi.waitFor(() => {
      expect(toast.warning).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(toast.warning).mock.calls[0]?.[0]).toBe(
      '1 added, 1 skipped',
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onRepositoriesAdded).toHaveBeenCalledWith([createdCard])
  })

  test('names the repository that was actually added in the success toast', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { boards: [], maintenance: [] },
    })
    vi.mocked(addRepositoriesToBoard).mockResolvedValue({
      success: true,
      data: {
        addedCount: 1,
        cards: [makeCreatedFreeRepoCard()],
        skipped: [],
      },
    })
    renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)

    // Act
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))

    // Assert
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('1 repository added', {
        description: '"laststance/free-repo" has been added to the board.',
      })
    })
  })

  test('does not add the pending selection when Enter is pressed on a held repository link', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        boards: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
          },
        ],
        maintenance: [],
      },
    })
    renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    const boardLink = screen.getByRole('link', {
      name: 'Open board Work Projects, which holds laststance/gitbox',
    })
    // jsdom-style environments cannot navigate; keep the default action inert
    boardLink.addEventListener('click', (event) => event.preventDefault())

    // Act
    boardLink.focus()
    await user.keyboard('{Enter}')

    // Assert
    expect(addRepositoriesToBoard).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add (1)' })).toBeEnabled()
  })
})

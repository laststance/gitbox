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
      name: 'On Work Projects, which holds laststance/gitbox',
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
      name: 'In Maintenance, which holds laststance/old-project',
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
        name: 'On Work Projects, which holds laststance/gitbox',
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
        name: 'On Work Projects, which holds laststance/gitbox',
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
    // The toast body says where the skipped repository lives
    const toastDescription = vi.mocked(toast.warning).mock.calls[0]?.[1]
      ?.description
    const { container: toastBody } = render(
      <div>
        {typeof toastDescription === 'function'
          ? toastDescription()
          : toastDescription}
      </div>,
    )
    expect(
      within(toastBody).getByText(
        'laststance/gitbox is already on board "Work Projects"',
      ),
    ).toBeVisible()
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
      name: 'On Work Projects, which holds laststance/gitbox',
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

  // Generated by /ship test coverage audit (pass 1).
  // Value: protects=the picker still offers repositories when the placement
  //   request rejects (offline, server action transport error);
  //   fails_when=the try/catch around getUserRepoPlacements is removed, leaving
  //   the picker on "Loading repositories..." forever with an unhandled
  //   rejection;
  //   why_new=the neighbouring test covers a resolved { success: false }, which
  //   never reaches the catch branch;
  //   seam=none
  test('keeps the picker usable when the placement request itself fails', async () => {
    // Arrange
    mockCatalog([
      makeRepository(1, 'free-repo'),
      makeRepository(3, 'old-project'),
    ])
    vi.mocked(getUserRepoPlacements).mockRejectedValue(
      new Error('Failed to fetch'),
    )

    // Act
    renderOpenPicker({ maintenanceRepoIdentifiers: ['laststance/old-project'] })

    // Assert
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('laststance/free-repo')
    expect(screen.queryByText('Loading repositories...')).toBeNull()
    expect(
      screen.queryByRole('list', { name: 'Already placed elsewhere' }),
    ).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // Generated by /ship test coverage audit (pass 1).
  // Value: protects=pressing Enter again while an add is running sends no
  //   second add request;
  //   fails_when=the !isAdding guard on the panel's Enter handler is removed,
  //   so the same selection is submitted twice and the second answer reports
  //   the repositories as already placed;
  //   why_new=existing Enter coverage is the held-link case only; nothing
  //   presses Enter during an add in flight;
  //   seam=none
  test('sends one add request when Enter is pressed again while the first add is still running', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { boards: [], maintenance: [] },
    })
    // The server does not answer for the duration of this test
    vi.mocked(addRepositoriesToBoard).mockReturnValue(new Promise(() => {}))
    renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    const searchInput = screen.getByRole('textbox', {
      name: 'Search repositories',
    })
    searchInput.focus()

    // Act
    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')

    // Assert
    expect(addRepositoriesToBoard).toHaveBeenCalledTimes(1)
    // The second Enter was typed inside the picker panel, not lost elsewhere
    expect(searchInput).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading repositories...',
    )
  })

  // Generated by /ship test coverage audit (pass 2).
  // Value: protects=a lost-race answer shows its sentence as an alert with the
  //   selection kept, and the notice of an earlier skipped attempt is gone;
  //   fails_when=the failure branch stops showing result.error, or starting an
  //   add no longer clears the skipped notice;
  //   why_new=no picker test returns success:false from the add action;
  //   seam=none
  test('shows the lost-race sentence as an alert, keeps the selection and drops the earlier skipped notice', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
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
    vi.mocked(addRepositoriesToBoard)
      // First attempt: the only selected repository is already placed
      .mockResolvedValueOnce({
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
      // Second attempt: another tab placed the repository during the insert
      .mockResolvedValueOnce({
        success: false,
        error:
          'Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.',
      })
    const { onOpenChange, onRepositoriesAdded } = renderOpenPicker()
    const optionsOnOpen = await findRepositoryOptions()
    await user.click(optionsOnOpen[1]!)
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))
    await screen.findByRole('note', {
      name: 'Repositories that were not added',
    })
    const [freeRepoOption] = await findRepositoryOptions()
    await user.click(freeRepoOption!)

    // Act
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.',
    )
    expect(
      screen.queryByRole('note', { name: 'Repositories that were not added' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Remove laststance/free-repo' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add (1)' })).toBeEnabled()
    expect(addRepositoriesToBoard).toHaveBeenCalledTimes(2)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(onRepositoriesAdded).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  // Generated by /ship test coverage audit (pass 2).
  // Value: protects=a repository the placements say is on the current board is
  //   neither offered nor listed as held, and with nothing else in the catalog
  //   the picker says 'No repositories left to add.';
  //   fails_when=the currentBoardId check in classifyRepositories is dropped;
  //   why_new=existing tests place repositories on other boards only;
  //   seam=none
  test('neither offers nor lists as held a repository the server reports on this board', async () => {
    // Arrange: the board's cards are not in the store, only the server knows
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        boards: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-1',
            boardName: 'Test Board',
          },
        ],
        maintenance: [],
      },
    })

    // Act
    renderOpenPicker()

    // Assert
    expect(
      await screen.findByText('No repositories left to add.'),
    ).toBeVisible()
    expect(
      screen.queryByRole('listbox', { name: 'Repository options' }),
    ).toBeNull()
    expect(
      screen.queryByRole('list', { name: 'Already placed elsewhere' }),
    ).toBeNull()
    expect(screen.queryByText('laststance/gitbox')).toBeNull()
    expect(
      screen.queryByText(
        'No repositories to add. The ones below are already placed.',
      ),
    ).toBeNull()
  })

  // Value: protects=a repository restored from Maintenance in another tab can
  //   be added without reloading the board page;
  //   fails_when=the page-load Maintenance list is applied even though fresh
  //   placements arrived, so the repository stays hidden until a reload;
  //   why_new=the two fallback tests cover failed placements only, where the
  //   page-load list is supposed to win;
  //   seam=none
  test('offers a repository that left Maintenance since the page loaded', async () => {
    // Arrange: the page loaded while laststance/old-project was in Maintenance
    mockCatalog([makeRepository(3, 'old-project')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { boards: [], maintenance: [] },
    })

    // Act
    renderOpenPicker({ maintenanceRepoIdentifiers: ['laststance/old-project'] })

    // Assert
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('laststance/old-project')
    expect(
      screen.queryByRole('list', { name: 'Already placed elsewhere' }),
    ).toBeNull()
  })

  // Value: protects=after an add that lost the race, the picker shows where
  //   the raced repository now lives instead of still offering it;
  //   fails_when=the failure branch stops refetching placements, so the
  //   repository stays among the options and every retry loses again;
  //   why_new=the lost-race test above refetches after its skipped attempt
  //   already, so it passes with or without a refetch on failure;
  //   seam=none
  test('moves the raced repository to the held list after an add that lost the race', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements)
      // On open: this picker does not know about the placement yet
      .mockResolvedValueOnce({
        success: true,
        data: { boards: [], maintenance: [] },
      })
      // Refetch after the lost race
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
      success: false,
      error:
        'Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.',
    })
    renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)

    // Act
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: Nothing was added. One of the selected repositories was just placed on a board. Reload the page and try again.',
    )
    const heldList = await screen.findByRole('list', {
      name: 'Already placed elsewhere',
    })
    expect(heldList).toBeVisible()
    expect(
      within(heldList).getByRole('link', {
        name: 'On Work Projects, which holds laststance/gitbox',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('listbox', { name: 'Repository options' }),
    ).toBeNull()
    expect(getUserRepoPlacements).toHaveBeenCalledTimes(2)
  })

  // Value: protects=a visibility filter that hides every repository says so,
  //   so the user widens the filter instead of believing the catalog is used up;
  //   fails_when=the empty state ignores the filters and always says 'No
  //   repositories left to add.';
  //   why_new=no picker test changes the visibility filter;
  //   seam=none
  test('says the filters hide everything instead of claiming nothing is left to add', async () => {
    // Arrange: every repository in the catalog is public
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { boards: [], maintenance: [] },
    })
    renderOpenPicker()
    await findRepositoryOptions()

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Visibility filter' }),
      'Private',
    )

    // Assert
    expect(
      await screen.findByText('No repositories match the current filters.'),
    ).toBeVisible()
    expect(screen.queryByText('No repositories left to add.')).toBeNull()
    expect(
      screen.queryByRole('listbox', { name: 'Repository options' }),
    ).toBeNull()
  })

  // Value: protects=Enter on the focused Cancel button cancels;
  //   fails_when=the panel's Enter handler submits for any focused element
  //   again, so Cancel adds the selection it was meant to discard;
  //   why_new=Enter is covered on a held link and in the search box only;
  //   seam=none
  test('pressing Enter on Cancel closes the picker without adding the selection', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(getUserRepoPlacements).mockResolvedValue({
      success: true,
      data: { boards: [], maintenance: [] },
    })
    const { onOpenChange } = renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    cancelButton.focus()

    // Act
    await user.keyboard('{Enter}')

    // Assert
    expect(addRepositoriesToBoard).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // Value: protects=a selection kept from the previous opening cannot be
  //   added with Enter before the picker knows where repositories live;
  //   fails_when=the Enter handler checks isAdding only, so a repository that
  //   another tab placed in the meantime is submitted while the Add button is
  //   still disabled;
  //   why_new=the Enter-during-add test covers isAdding; nothing presses Enter
  //   while placements load;
  //   seam=none
  test('Enter in the search box does not add while placements are still loading', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(getUserRepoPlacements)
      // First opening
      .mockResolvedValueOnce({
        success: true,
        data: { boards: [], maintenance: [] },
      })
      // Second opening: the server does not answer for the rest of this test
      .mockReturnValueOnce(new Promise(() => {}))
    const store = configureStore({
      reducer: { board: boardReducer, settings: settingsReducer },
    })
    const onRepositoriesAdded = vi.fn()
    const renderPicker = (isOpen: boolean) => (
      <Provider store={store}>
        <AddRepositoryCombobox
          boardId={toBoardId('board-1')}
          statusId={toStatusListId('status-1')}
          isOpen={isOpen}
          onRepositoriesAdded={onRepositoriesAdded}
        />
      </Provider>
    )
    const { rerender } = render(renderPicker(true))
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    // The board page closes the picker and opens it again; the selection is kept
    rerender(renderPicker(false))
    rerender(renderPicker(true))
    const searchInput = screen.getByRole('textbox', {
      name: 'Search repositories',
    })
    searchInput.focus()

    // Act
    await user.keyboard('{Enter}')

    // Assert
    expect(addRepositoriesToBoard).not.toHaveBeenCalled()
    expect(searchInput).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading repositories...',
    )
    expect(
      screen.getByRole('button', { name: 'Remove laststance/free-repo' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add (1)' })).toBeDisabled()
  })
})

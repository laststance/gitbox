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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memo, useState } from 'react'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { AddRepositoryCombobox } from '@/components/Board/AddRepositoryCombobox'
import {
  getAuthenticatedRepositoryCatalog,
  type GitHubRepository,
} from '@/lib/actions/github'
import {
  addRepositoriesToBoard,
  moveCardToBoard,
  type CreatedRepoCard,
} from '@/lib/actions/repo-cards'
import {
  fetchRepoPlacements,
  fetchSavedRepositoryMemories,
} from '@/lib/fetch-repo-placements'
import type { StatusListDomain } from '@/lib/models/domain'
import boardReducer, {
  setRepoCards,
  setStatusLists,
} from '@/lib/redux/slices/boardSlice'
import boardSyncReducer from '@/lib/redux/slices/boardSyncSlice'
import settingsReducer from '@/lib/redux/slices/settingsSlice'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'
import { isOverlayOpen } from '@/lib/utils/is-overlay-open'

vi.mock('@/lib/actions/github', () => ({
  getAuthenticatedRepositoryCatalog: vi.fn(),
}))

vi.mock('@/lib/fetch-repo-placements', () => ({
  fetchRepoPlacements: vi.fn(),
  fetchSavedRepositoryMemories: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(fetchSavedRepositoryMemories).mockResolvedValue({
    success: true,
    data: [],
  })
})

vi.mock('@/lib/actions/repo-cards', () => ({
  addRepositoriesToBoard: vi.fn(),
  moveCardToBoard: vi.fn(),
}))

vi.mock('@/lib/utils/handle-github-token-missing', () => ({
  clearGitHubRefreshAttempts: vi.fn(),
  handleGitHubTokenMissing: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

// happy-dom lays nothing out, so the real virtualizer finds no visible row.
// This one shows the first 25 rows; only a list of more than 20 repositories
// draws them.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: (): number => count * 100,
    getVirtualItems: (): { index: number; key: number; start: number }[] =>
      Array.from({ length: Math.min(count, 25) }, (_, index) => ({
        index,
        key: index,
        start: index * 100,
      })),
    measureElement: (): void => undefined,
  }),
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
    comment: { comment: '', color: 'primary' },
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

/**
 * Render the open picker for board-1 inside a fresh store.
 * @param columns - Columns of board-1, which Move Here reads.
 */
function renderOpenPicker(columns: StatusListDomain[] = []) {
  const store = configureStore({
    reducer: {
      board: boardReducer,
      settings: settingsReducer,
      boardSync: boardSyncReducer,
    },
  })
  // Move Here reads the columns of the board on screen
  if (columns.length > 0) store.dispatch(setStatusLists(columns))
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
      />
    </Provider>,
  )
  return { onOpenChange, onRepositoriesAdded }
}

/**
 * The picker, opened and closed by its own Cancel, plus the column button
 * that opens it again. That button does not clear the picker's notices.
 */
const ColumnReopenedPicker = memo(function ColumnReopenedPicker({
  onRepositoriesAdded,
}: {
  onRepositoriesAdded: (cards: CreatedRepoCard[]) => void
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [store] = useState(() =>
    configureStore({
      reducer: {
        board: boardReducer,
        settings: settingsReducer,
        boardSync: boardSyncReducer,
      },
    }),
  )
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Add Repo
      </button>
      <Provider store={store}>
        <AddRepositoryCombobox
          boardId={toBoardId('board-1')}
          statusId={toStatusListId('status-1')}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          onRepositoriesAdded={onRepositoriesAdded}
        />
      </Provider>
    </>
  )
})

/** Holds `addRepositoriesToBoard` until the test lets it finish. */
function holdTheAdd(): {
  finish: (result: Awaited<ReturnType<typeof addRepositoriesToBoard>>) => void
} {
  let finish: (
    result: Awaited<ReturnType<typeof addRepositoriesToBoard>>,
  ) => void = () => {}
  vi.mocked(addRepositoriesToBoard).mockImplementation(
    async () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  return {
    finish: (result): void => {
      finish(result)
    },
  }
}

/** Holds `addRepositoriesToBoard` until the test rejects it. */
function holdTheRejectedAdd(): { fail: (error: Error) => void } {
  let fail: (error: Error) => void = () => {}
  vi.mocked(addRepositoriesToBoard).mockImplementation(
    async () =>
      new Promise((_resolve, reject) => {
        fail = reject
      }),
  )
  return {
    fail: (error): void => {
      fail(error)
    },
  }
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

describe('AddRepositoryCombobox with a selected repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=the name on the badge of a selected repository is readable in every theme; fails_when=the badge label is drawn in the theme color again, which on its own 10% tint is below 4.5:1 in 12 of the 14 themes; why_new=no test named the colors of the badge; seam=none; no_claim=the contrast itself (computed for every theme in selected-repository-badge-contrast.test.ts)
  test('shows a selected repository as a badge with a tint of the theme color under a label in the text color', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    renderOpenPicker()
    const [freeRepoOption] = await findRepositoryOptions()

    // Act
    await user.click(freeRepoOption!)

    // Assert: the badge is the element around its remove button
    const badge = screen.getByRole('button', {
      name: 'Remove laststance/free-repo',
    }).parentElement
    expect(badge).toHaveTextContent('laststance/free-repo')
    expect(badge).toHaveClass('bg-primary/10', 'text-foreground')
    expect(badge).not.toHaveClass('text-primary')
  })
})

describe('AddRepositoryCombobox panel and the place of its button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Value: protects=the panel knows how far down its button ends, also after the page around the button changed, and nothing keeps watching a panel that is closed; fails_when=the place of the button is measured once at opening, or the watcher is left running when the panel is removed; why_new=no test read what the panel is told, and removing the cleanup left every test green; seam=ResizeObserver and getBoundingClientRect (happy-dom lays nothing out and never reports a size); no_claim=where the panel then stands (measured in a browser, e2e/logged-in/add-repository-combobox.spec.ts)
  test('tells the panel where its button ends, again when the page around it changes size, and stops watching when the panel closes', async () => {
    // Arrange: watchers that can be made to report by hand, and a button
    // that ends 63px down
    const sizeWatchers: SizeWatcherStandIn[] = []
    class SizeWatcherStandIn {
      readonly watched: Element[] = []
      isWatching = true
      constructor(readonly report: () => void) {
        sizeWatchers.push(this)
      }
      observe(element: Element): void {
        this.watched.push(element)
      }
      unobserve(): void {}
      disconnect(): void {
        this.isWatching = false
      }
    }
    vi.stubGlobal('ResizeObserver', SizeWatcherStandIn)
    let buttonBottomPx = 63
    vi.spyOn(
      HTMLButtonElement.prototype,
      'getBoundingClientRect',
    ).mockImplementation(() => new DOMRect(900, buttonBottomPx - 38, 160, 38))
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const store = configureStore({
      reducer: { board: boardReducer, settings: settingsReducer },
    })
    const renderPicker = (isOpen: boolean) => (
      <Provider store={store}>
        <AddRepositoryCombobox
          boardId={toBoardId('board-1')}
          statusId={toStatusListId('status-1')}
          isOpen={isOpen}
          onRepositoriesAdded={vi.fn()}
        />
      </Provider>
    )

    // Act: the panel opens
    const { rerender } = render(renderPicker(true))
    await findRepositoryOptions()

    // Assert: it was told where the button ends, and something watches the
    // elements around the button, up to the page itself
    const panel = screen.getByRole('combobox', { expanded: true })
    expect(panel.style.getPropertyValue('--button-bottom')).toBe('63px')
    const pageWatcher = sizeWatchers.find((sizeWatcher) =>
      sizeWatcher.watched.includes(document.body),
    )
    expect(pageWatcher?.isWatching).toBe(true)

    // Act: the header wraps, the button ends 120px further down
    buttonBottomPx = 183
    act(() => pageWatcher?.report())

    // Assert
    expect(panel.style.getPropertyValue('--button-bottom')).toBe('183px')

    // Act: the panel closes
    rerender(renderPicker(false))

    // Assert
    expect(pageWatcher?.isWatching).toBe(false)
  })
})

describe('AddRepositoryCombobox as a layer over the board', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=Z does not undo a drag on the board behind the open picker while the picker loads its repositories; fails_when=the guard knows the open picker by its list of options only, which is not there while it loads or finds nothing; why_new=the tests of the guard put elements with a role into the page by hand and never render the picker; seam=none; no_claim=that Z does nothing while a layer is open, which useKanbanUndo.test.tsx checks
  test('counts as a layer over the board while its repositories are still loading, when it has no list of options', () => {
    // Arrange: neither request is answered for the rest of this test
    vi.mocked(getAuthenticatedRepositoryCatalog).mockReturnValue(
      new Promise(() => {}),
    )
    vi.mocked(fetchRepoPlacements).mockReturnValue(new Promise(() => {}))

    // Act
    renderOpenPicker()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading repositories…',
    )
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(isOverlayOpen()).toBe(true)
  })

  // Value: protects=Z undoes a drag on a board whose picker is closed; fails_when=the mark of a layer sits on a part of the picker that stays on the page, such as its button, which would switch the shortcut off on every board; why_new=the mark is new; seam=none; no_claim=none
  test('is no layer while it is closed', () => {
    // Arrange
    mockCatalog([])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const store = configureStore({
      reducer: { board: boardReducer, settings: settingsReducer },
    })

    // Act
    render(
      <Provider store={store}>
        <AddRepositoryCombobox
          boardId={toBoardId('board-1')}
          statusId={toStatusListId('status-1')}
          isOpen={false}
          onRepositoriesAdded={vi.fn()}
        />
      </Provider>,
    )

    // Assert
    expect(
      screen.getByRole('button', { name: /add repositories/i }),
    ).toBeVisible()
    expect(isOverlayOpen()).toBe(false)
  })
})

describe('AddRepositoryCombobox and the Escape key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=Escape in the open list of organizations closes that list and leaves the picker open; fails_when=the panel takes the Escape of the list for its own and closes the picker too, which it did because React hands a key of the list up to the panel; why_new=no test pressed Escape in the picker; seam=none; no_claim=where the keyboard focus is while the list is open and that the search box keeps what was typed, which a browser test shows (e2e/logged-in/add-repository-combobox.spec.ts)
  test('closes the list of organizations and leaves the picker open when Escape is pressed in that list', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const { onOpenChange } = renderOpenPicker()
    await findRepositoryOptions()
    await user.click(
      screen.getByRole('combobox', { name: 'Organization filter' }),
    )
    expect(
      await screen.findByRole('option', { name: 'All Organizations' }),
    ).toBeVisible()

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(
      screen.queryByRole('option', { name: 'All Organizations' }),
    ).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  // Value: protects=Escape closes the picker from its search box, the way out for a keyboard user; fails_when=the panel ignores every Escape, not only the one a layer above it has used; why_new=no test pressed Escape in the picker; seam=none; no_claim=where the keyboard focus goes once the picker is closed (TODOS.md)
  test('closes the picker when Escape is pressed in the search box', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const { onOpenChange } = renderOpenPicker()
    await findRepositoryOptions()
    await user.click(
      screen.getByRole('textbox', { name: 'Search repositories' }),
    )

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('AddRepositoryCombobox with repositories placed elsewhere', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Value: protects=the picker tells which repositories bring a note, links or a comment back, matched whatever GitHub's letter case (issue #216); fails_when=savedMemories are not passed to the rows, the label is missing, or the match is case-sensitive; why_new=new mark; seam=none; no_claim=which rows count as saved (saved-repository-memories.test.ts) and the server lookup (mocked)
  test('marks a repository on no board with what comes back when it is added again', async () => {
    // Arrange
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'NSX')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    vi.mocked(fetchSavedRepositoryMemories).mockResolvedValue({
      success: true,
      data: [
        {
          identifier: 'laststance/nsx',
          hasNote: true,
          linkCount: 2,
          hasComment: true,
        },
      ],
    })

    // Act
    renderOpenPicker()

    // Assert
    const savedOption = await screen.findByRole('option', {
      name: /laststance\/NSX/,
    })
    expect(
      within(savedOption).getByText('Saved: note, 2 links, comment'),
    ).toBeVisible()
    const freeOption = screen.getByRole('option', {
      name: /laststance\/free-repo/,
    })
    expect(
      within(freeOption).queryByTestId('saved-memory-label'),
    ).not.toBeInTheDocument()
  })

  // Value: protects=the repository list can be used before the Saved marks arrive; fails_when=the options stay locked until the mark request settles; why_new=the marks used to share the placements response; seam=none; no_claim=which rows count as saved (saved-repository-memories.test.ts)
  test('lets a repository be chosen before its Saved mark arrives', async () => {
    // Arrange
    mockCatalog([makeRepository(2, 'NSX')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const marks =
      Promise.withResolvers<
        Awaited<ReturnType<typeof fetchSavedRepositoryMemories>>
      >()
    vi.mocked(fetchSavedRepositoryMemories).mockReturnValue(marks.promise)

    // Act
    renderOpenPicker()

    // Assert
    const option = await screen.findByRole('option', {
      name: /laststance\/NSX/,
    })
    await waitFor(() => {
      expect(option).toHaveAttribute('aria-disabled', 'false')
    })
    expect(screen.queryByTestId('saved-memory-label')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Checking where repositories are placed…'),
    ).not.toBeInTheDocument()

    await act(async () => {
      marks.resolve({
        success: true,
        data: [
          {
            identifier: 'laststance/nsx',
            hasNote: true,
            linkCount: 0,
            hasComment: false,
          },
        ],
      })
    })
    expect(within(option).getByText('Saved: note')).toBeVisible()
  })

  // Value: protects=a failed saved-memory lookup costs only the marks: the picker still lists free repositories and the ones placed elsewhere (issue #216, R3); fails_when=the picker breaks or hides the held list on savedMemories null; why_new=only the server action's degrade was tested; seam=none; no_claim=the Sentry report of the failed lookup (board-data.placements.test.ts)
  test('lists free and held repositories without marks when what is saved could not be looked up', async () => {
    // Arrange
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
      },
    })
    vi.mocked(fetchSavedRepositoryMemories).mockRejectedValue(
      new Error('Failed to fetch'),
    )

    // Act
    renderOpenPicker()

    // Assert
    expect(
      await screen.findByRole('list', { name: 'Already placed elsewhere' }),
    ).toBeVisible()
    expect(
      screen.getByRole('option', { name: /laststance\/free-repo/ }),
    ).toBeVisible()
    expect(screen.queryByTestId('saved-memory-label')).not.toBeInTheDocument()
  })

  // Value: protects=the mark shows in the virtualized list (more than 20 repositories) that a user with many repositories sees; fails_when=only the plain list draws the mark, as the two lists repeat the row markup; why_new=the mark test above uses 2 repositories; seam=@tanstack/react-virtual stubbed (happy-dom lays nothing out); no_claim=scrolling and row measuring
  test('marks a repository with what comes back when it is added again, also when the long list is virtualized', async () => {
    // Arrange: 21 repositories switch the picker to virtual scrolling
    const repositories = Array.from({ length: 21 }, (_, index) =>
      makeRepository(index + 1, `repo-${index + 1}`),
    )
    mockCatalog(repositories)
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    vi.mocked(fetchSavedRepositoryMemories).mockResolvedValue({
      success: true,
      data: [
        {
          identifier: 'laststance/repo-3',
          hasNote: true,
          linkCount: 0,
          hasComment: false,
        },
      ],
    })

    // Act
    renderOpenPicker()

    // Assert
    const listbox = await screen.findByRole('listbox', {
      name: 'Repository options',
    })
    expect(listbox).toHaveAttribute('data-virtual-scroll', 'true')
    const savedOption = within(listbox).getByRole('option', {
      name: /laststance\/repo-3\b/,
    })
    expect(within(savedOption).getByText('Saved: note')).toBeVisible()
    expect(within(listbox).getAllByTestId('saved-memory-label')).toHaveLength(1)
  })

  test('lists a repository held by another board with a link to that board instead of offering it', async () => {
    // Arrange
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
      },
    })

    // Act
    renderOpenPicker()

    // Assert
    const heldList = await screen.findByRole('list', {
      name: 'Already placed elsewhere',
    })
    // Level 2: the panel stands in the header, right under the board's h1
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Already placed elsewhere (1)',
      }),
    ).toBeVisible()
    expect(within(heldList).getByText('laststance/gitbox')).toBeVisible()
    const boardLink = within(heldList).getByRole('link', {
      name: 'On Work Projects, which holds laststance/gitbox',
    })
    expect(boardLink).toHaveTextContent('On Work Projects')
    expect(boardLink).toHaveAttribute(
      'href',
      '/board/board-2?card=00000000-0000-4000-8000-0000000000c2',
    )
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('laststance/free-repo')
  })

  test('moves a held repository onto the column the picker was opened for', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
      },
    })
    vi.mocked(moveCardToBoard).mockResolvedValue({
      success: true,
      data: undefined,
    })
    renderOpenPicker([
      {
        id: toStatusListId('status-1'),
        title: 'To Do',
        color: '#6B7280',
        gridRow: 0,
        gridCol: 0,
        boardId: toBoardId('board-1'),
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ])

    // Act
    const heldList = await screen.findByRole('list', {
      name: 'Already placed elsewhere',
    })
    await user.click(
      within(heldList).getByRole('button', {
        name: 'Move Here, laststance/gitbox',
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Move Here' })
    await user.click(within(dialog).getByRole('button', { name: 'Move Here' }))

    // Assert
    expect(moveCardToBoard).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-0000000000c2',
      'board-1',
      'status-1',
    )
  })

  test('shows where a repository lives when the search matches only a held repository', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
      },
    })
    renderOpenPicker()
    await screen.findByRole('list', { name: 'Already placed elsewhere' })

    // Act
    await user.type(
      screen.getByRole('textbox', { name: 'Search repositories' }),
      'gitbox',
    )

    // Assert: the sentence blames the search, not an exhausted catalog
    expect(
      await screen.findByText(
        'Nothing to add matches the search or filters. The ones below are already placed.',
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
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
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: false,
      error: 'An unexpected error occurred',
    })

    // Act
    renderOpenPicker()

    // Assert
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('laststance/free-repo')
    expect(options[1]).toHaveTextContent('laststance/gitbox')
    expect(
      screen.queryByRole('list', { name: 'Already placed elsewhere' }),
    ).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('keeps the picker open and explains why when every selected repository was skipped', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements)
      // On open: this picker does not know about the placement yet
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
      })
      // Refetch after the skipped result
      .mockResolvedValue({
        success: true,
        data: {
          placements: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
              cardId: '00000000-0000-4000-8000-0000000000c2',
            },
          ],
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-2',
            boardName: 'Work Projects',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
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
  //   fails_when=the try/catch around fetchRepoPlacements is removed, leaving
  //   the picker on "Loading repositories…" forever with an unhandled
  //   rejection;
  //   why_new=the neighbouring test covers a resolved { success: false }, which
  //   never reaches the catch branch;
  //   seam=none
  test('keeps the picker usable when the placement request itself fails', async () => {
    // Arrange
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockRejectedValue(
      new Error('Failed to fetch'),
    )

    // Act
    renderOpenPicker()

    // Assert
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('laststance/free-repo')
    expect(options[1]).toHaveTextContent('laststance/gitbox')
    expect(screen.queryByText('Loading repositories…')).toBeNull()
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
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
    expect(screen.getByRole('status')).toHaveTextContent('Adding repositories…')
    expect(screen.queryByText('Loading repositories…')).toBeNull()
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
    vi.mocked(fetchRepoPlacements)
      // On open: this picker does not know about the placement yet
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
      })
      // Refetch after the skipped result
      .mockResolvedValue({
        success: true,
        data: {
          placements: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
              cardId: '00000000-0000-4000-8000-0000000000c2',
            },
          ],
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
          'Nothing was added. One of the selected repositories was just placed on a board. The list is refreshing.',
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
      'Error: Nothing was added. One of the selected repositories was just placed on a board. The list is refreshing.',
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: {
        placements: [
          {
            identifier: 'laststance/gitbox',
            boardId: 'board-1',
            boardName: 'Test Board',
            cardId: '00000000-0000-4000-8000-0000000000c2',
          },
        ],
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
    vi.mocked(fetchRepoPlacements)
      // On open: this picker does not know about the placement yet
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
      })
      // Refetch after the lost race
      .mockResolvedValue({
        success: true,
        data: {
          placements: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
              cardId: '00000000-0000-4000-8000-0000000000c2',
            },
          ],
        },
      })
    vi.mocked(addRepositoriesToBoard).mockResolvedValue({
      success: false,
      error:
        'Nothing was added. One of the selected repositories was just placed on a board. The list is refreshing.',
    })
    renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)

    // Act
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: Nothing was added. One of the selected repositories was just placed on a board. The list is refreshing.',
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
    expect(fetchRepoPlacements).toHaveBeenCalledTimes(2)
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    renderOpenPicker()
    await findRepositoryOptions()

    // Act
    await user.click(
      screen.getByRole('combobox', { name: 'Visibility filter' }),
    )
    await user.click(screen.getByRole('option', { name: 'Private' }))

    // Assert
    expect(
      await screen.findByText('No repositories match the current filters.'),
    ).toBeVisible()
    expect(screen.queryByText('No repositories left to add.')).toBeNull()
    expect(
      screen.queryByRole('listbox', { name: 'Repository options' }),
    ).toBeNull()
  })

  // Value: protects=star counts use a lucide icon and Visibility is a Radix
  //   select; fails_when=the row paints ⭐ or the filter is a native <select>
  //   again; why_new=the 2026-10-12 leftovers used an emoji and a native
  //   control next to the organization Radix select; seam=none
  test('shows star counts with a lucide icon and a Radix visibility filter', async () => {
    // Arrange
    mockCatalog([{ ...makeRepository(1, 'free-repo'), stargazers_count: 42 }])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    renderOpenPicker()
    await findRepositoryOptions()

    // Act
    const starCount = screen.getByTestId('repo-star-count')
    const visibility = screen.getByRole('combobox', {
      name: 'Visibility filter',
    })

    // Assert
    expect(starCount).toBeVisible()
    expect(starCount).toHaveTextContent('42')
    expect(starCount.querySelector('svg')).not.toBeNull()
    expect(starCount.textContent).not.toContain('⭐')
    expect(visibility.tagName).not.toBe('SELECT')
    expect(document.querySelector('select')).toBeNull()
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
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
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
    vi.mocked(fetchRepoPlacements)
      // First opening
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
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
    expect(screen.queryByText('Loading repositories…')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking where repositories are placed…',
    )
    const [reopenedOption] = await findRepositoryOptions()
    expect(reopenedOption).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByRole('button', { name: 'Remove laststance/free-repo' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add (1)' })).toBeDisabled()
  })

  test('keeps a cached repository on screen and ignores a click while placements are still loading', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(fetchRepoPlacements)
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
      })
      .mockReturnValueOnce(new Promise(() => {}))
    const store = configureStore({
      reducer: { board: boardReducer, settings: settingsReducer },
    })
    const renderPicker = (isOpen: boolean) => (
      <Provider store={store}>
        <AddRepositoryCombobox
          boardId={toBoardId('board-1')}
          statusId={toStatusListId('status-1')}
          isOpen={isOpen}
          onRepositoriesAdded={vi.fn()}
        />
      </Provider>
    )
    const { rerender } = render(renderPicker(true))
    await findRepositoryOptions()
    rerender(renderPicker(false))
    rerender(renderPicker(true))
    const [onlyOption] = await findRepositoryOptions()

    // Act
    await user.click(onlyOption!)

    // Assert
    expect(onlyOption).toBeVisible()
    expect(onlyOption).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.queryByRole('button', { name: 'Remove laststance/free-repo' }),
    ).toBeNull()
    expect(screen.queryByText('Loading repositories…')).toBeNull()
  })

  // Value: protects=a repository already on this board stays hidden when the
  //   placement request fails, so it cannot be offered a second time;
  //   fails_when=the store-based "already on this board" check is dropped from
  //   classifyRepositories (the fetched placements hide it in every other test);
  //   why_new=the deleted "Existing Repo Filtering" block tested a copy of this
  //   logic, never the picker itself;
  //   seam=none
  test('keeps hiding a repository that is already on this board when placements cannot be loaded', async () => {
    // Arrange: the board's card is in the store with a different letter case
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: false,
      error: 'An unexpected error occurred',
    })
    const store = configureStore({
      reducer: { board: boardReducer, settings: settingsReducer },
    })
    store.dispatch(
      setRepoCards([
        {
          id: toRepoCardId('card-1'),
          title: 'Laststance/GitBox',
          statusId: toStatusListId('status-1'),
          boardId: toBoardId('board-1'),
          repoOwner: 'Laststance',
          repoName: 'GitBox',
          order: 0,
          meta: {},
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]),
    )

    // Act
    render(
      <Provider store={store}>
        <AddRepositoryCombobox
          boardId={toBoardId('board-1')}
          statusId={toStatusListId('status-1')}
          isOpen
          onRepositoriesAdded={vi.fn()}
        />
      </Provider>,
    )

    // Assert
    const options = await findRepositoryOptions()
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('laststance/free-repo')
  })

  // Value: protects=the "not added" notice does not survive cancelling the
  //   picker, so the next opening starts clean;
  //   fails_when=handleClose stops clearing the skipped messages (the picker
  //   stays mounted while closed, so the notice would still be there);
  //   why_new=existing tests clear the notice only by starting another add;
  //   seam=none
  test('forgets the not-added notice once the picker is cancelled', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
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
    const { onOpenChange } = renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Repositories that were not added',
      }),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Assert
    expect(
      screen.queryByRole('note', { name: 'Repositories that were not added' }),
    ).toBeNull()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // Value: protects=an add that finishes after Cancel does not leave its
  //   "not added" notice for the column's next Add Repo;
  //   fails_when=the result is stored after the picker has closed;
  //   why_new=Cancel stays enabled while the add runs, and Add Repo does not
  //   clear the notice the way the header button does;
  //   seam=none
  test('a not-added notice that arrives after Cancel is absent when Add Repo opens the picker', async () => {
    // Arrange
    const user = userEvent.setup()
    const pending = holdTheAdd()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const onRepositoriesAdded = vi.fn()
    render(<ColumnReopenedPicker onRepositoriesAdded={onRepositoriesAdded} />)
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))
    await screen.findByText('Adding repositories…')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Act
    await act(async () => {
      pending.finish({
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
    })
    await user.click(screen.getByRole('button', { name: 'Add Repo' }))
    await findRepositoryOptions()

    // Assert
    expect(
      screen.queryByRole('note', { name: 'Repositories that were not added' }),
    ).toBeNull()
    expect(onRepositoriesAdded).not.toHaveBeenCalled()
  })

  // Value: protects=a repository the server skipped after Add Repo reopened
  //   moves to "Already placed elsewhere", without the not-added notice;
  //   fails_when=the late zero-add result returns without refreshing placements;
  //   why_new=the opening's own fetch can finish before that result, and it
  //   does not know the repository was placed;
  //   seam=none
  test('a repository skipped after Add Repo reopens moves to the held list', async () => {
    // Arrange
    const user = userEvent.setup()
    const pending = holdTheAdd()
    mockCatalog([makeRepository(2, 'gitbox')])
    const held = {
      identifier: 'laststance/gitbox',
      boardId: 'board-2',
      boardName: 'Work Projects',
      cardId: '00000000-0000-4000-8000-0000000000c2',
    }
    const answers = [
      { placements: [] },
      { placements: [] },
      {
        placements: [held],
      },
    ]
    vi.mocked(fetchRepoPlacements).mockImplementation(async () => ({
      success: true as const,
      data: answers.shift() ?? { placements: [held] },
    }))
    render(<ColumnReopenedPicker onRepositoriesAdded={vi.fn()} />)
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))
    await screen.findByText('Adding repositories…')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Add Repo' }))

    // Act
    await act(async () => {
      pending.finish({
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
    })

    // Assert
    expect(
      await screen.findByRole('link', {
        name: 'On Work Projects, which holds laststance/gitbox',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('listbox', { name: 'Repository options' }),
    ).toBeNull()
    expect(
      screen.queryByRole('note', { name: 'Repositories that were not added' }),
    ).toBeNull()
  })

  // Value: protects=an error that arrives after Cancel is not waiting on the
  //   next opening;
  //   fails_when=the failed add stores its message after the picker closed;
  //   why_new=the "not added" notice and the error are stored on different
  //   paths, and only the notice was cleared on close;
  //   seam=none
  test('an add error that arrives after Cancel is absent when Add Repo opens the picker', async () => {
    // Arrange
    const user = userEvent.setup()
    const pending = holdTheAdd()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    render(<ColumnReopenedPicker onRepositoriesAdded={vi.fn()} />)
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))
    await screen.findByText('Adding repositories…')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Act
    await act(async () => {
      pending.finish({
        success: false,
        error: 'Could not add the repositories',
      })
    })
    await user.click(screen.getByRole('button', { name: 'Add Repo' }))
    await findRepositoryOptions()

    // Assert
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Could not add the repositories')).toBeNull()
  })

  // Value: protects=a request that rejects after Cancel does not leave its
  //   message on the next opening;
  //   fails_when=the catch path stores the error without looking at whether
  //   the picker has since closed;
  //   why_new=an error result and a rejected promise are stored in different
  //   places;
  //   seam=none
  test('a rejected add that arrives after Cancel is absent when Add Repo opens the picker', async () => {
    // Arrange
    const user = userEvent.setup()
    const pending = holdTheRejectedAdd()
    mockCatalog([makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    render(<ColumnReopenedPicker onRepositoriesAdded={vi.fn()} />)
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))
    await screen.findByText('Adding repositories…')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Act
    await act(async () => {
      pending.fail(new Error('The add request failed'))
    })
    await user.click(screen.getByRole('button', { name: 'Add Repo' }))
    await findRepositoryOptions()

    // Assert
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('The add request failed')).toBeNull()
  })

  // Value: protects=repositories that were added after the picker was opened
  //   again still land on the board, and that opening stays open;
  //   fails_when=the success path closes whatever picker is on screen, or
  //   drops the cards because the attempt had been cancelled;
  //   why_new=Cancel starts a new opening, and the old request can finish
  //   after Add Repo has opened it;
  //   seam=none
  test('repositories added after Add Repo reopens the picker still reach the board and leave it open', async () => {
    // Arrange
    const user = userEvent.setup()
    const pending = holdTheAdd()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    const onRepositoriesAdded = vi.fn()
    render(<ColumnReopenedPicker onRepositoriesAdded={onRepositoriesAdded} />)
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    await user.click(screen.getByRole('button', { name: 'Add (1)' }))
    await screen.findByText('Adding repositories…')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Add Repo' }))
    expect(screen.getByText('Adding repositories…')).toBeVisible()
    const card = makeCreatedFreeRepoCard()

    // Act
    await act(async () => {
      pending.finish({
        success: true,
        data: { addedCount: 1, cards: [card], skipped: [] },
      })
    })

    // Assert
    expect(onRepositoriesAdded).toHaveBeenCalledWith([card])
    expect(
      await screen.findByRole('listbox', { name: 'Repository options' }),
    ).toBeVisible()
  })

  // Value: protects=Enter that confirms a Japanese (IME) conversion in the
  //   search box only confirms the conversion;
  //   fails_when=the panel's key handler loses its composition guard, so
  //   confirming a conversion adds the selection and closes the picker;
  //   why_new=no test types into the search box through an IME;
  //   seam=none
  test('confirming an IME conversion with Enter in the search box does not add the selection', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo')])
    vi.mocked(fetchRepoPlacements).mockResolvedValue({
      success: true,
      data: { placements: [] },
    })
    vi.mocked(addRepositoriesToBoard).mockResolvedValue({
      success: true,
      data: { addedCount: 1, cards: [makeCreatedFreeRepoCard()], skipped: [] },
    })
    renderOpenPicker()
    const [onlyOption] = await findRepositoryOptions()
    await user.click(onlyOption!)
    const searchInput = screen.getByRole('textbox', {
      name: 'Search repositories',
    })

    // Act: the keydown a browser sends while a conversion is being confirmed
    fireEvent.keyDown(searchInput, {
      key: 'Enter',
      isComposing: true,
      keyCode: 229,
    })

    // Assert: nothing is added by the conversion...
    expect(addRepositoriesToBoard).not.toHaveBeenCalled()
    // ...while a plain Enter in the same box still adds
    fireEvent.keyDown(searchInput, { key: 'Enter', keyCode: 13 })
    expect(addRepositoriesToBoard).toHaveBeenCalledTimes(1)
  })

  // Value: protects=a repository placed while the picker was closed is not
  //   still selected when it opens again;
  //   fails_when=the selection survives a reopen that learned the repository
  //   is already on a board, so Add can send it again;
  //   why_new=the selection used to outlive the placements of a new opening;
  //   seam=none
  test('drops a selected repository that was placed while the picker was closed, and keeps one that is still free', async () => {
    // Arrange
    const user = userEvent.setup()
    mockCatalog([makeRepository(1, 'free-repo'), makeRepository(2, 'gitbox')])
    vi.mocked(fetchRepoPlacements)
      .mockResolvedValueOnce({
        success: true,
        data: { placements: [] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          placements: [
            {
              identifier: 'laststance/gitbox',
              boardId: 'board-2',
              boardName: 'Work Projects',
              cardId: '00000000-0000-4000-8000-0000000000c2',
            },
          ],
        },
      })
    render(<ColumnReopenedPicker onRepositoriesAdded={vi.fn()} />)
    const options = await findRepositoryOptions()
    await user.click(options[0]!)
    await user.click(options[1]!)
    expect(
      screen.getByRole('button', { name: 'Remove laststance/free-repo' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Remove laststance/gitbox' }),
    ).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Add Repo' }))

    // Assert
    await screen.findByRole('list', { name: 'Already placed elsewhere' })
    expect(
      screen.queryByRole('button', { name: 'Remove laststance/gitbox' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Remove laststance/free-repo' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add (1)' })).toBeVisible()
  })
})

/**
 * Unit Test: BoardPageClient Component
 *
 * Test targets:
 * - Redux store hydration via useLayoutEffect
 * - Handler functions (removeFromBoard)
 * - Component rendering with mocked hooks
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

import { BoardPageClient } from '@/app/board/[id]/BoardPageClient'
import type * as BoardServerSyncModule from '@/hooks/board/useBoardServerSync'
import type { BoardInitialData } from '@/lib/actions/board-data'
import boardSlice, { setRepoCards } from '@/lib/redux/slices/boardSlice'
import boardSyncSlice, {
  boardRefreshRequested,
  trackBoardWrite,
} from '@/lib/redux/slices/boardSyncSlice'
import type { Board } from '@/lib/supabase/types'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

// Mock dependencies
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

// Mock server actions
const mockDeleteRepoCard = vi.fn()
vi.mock('@/lib/actions/repo-cards', () => ({
  deleteRepoCard: (...args: unknown[]) => mockDeleteRepoCard(...args),
}))

// Mock hooks with minimal implementations. useBoardServerSync is the real
// one: it is what puts the page data into the store.
vi.mock('@/hooks/board', async () => ({
  useBoardServerSync: (
    await vi.importActual<typeof BoardServerSyncModule>(
      '@/hooks/board/useBoardServerSync',
    )
  ).useBoardServerSync,
  useBoardSettings: () => ({
    isOpen: false,
    displayName: 'Test Board',
    displaySubtitle: '',
    cardDisplaySettings: { showStars: true, showLanguage: true },
    open: vi.fn(),
    close: vi.fn(),
    handleRenameSuccess: vi.fn(),
    handleSubtitleChange: vi.fn(),
    handleCardDisplayChange: vi.fn(),
  }),
  useProjectInfoModal: () => ({
    isOpen: false,
    projectInfo: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
    saveProjectInfo: vi.fn(),
  }),
  useStatusListDialog: () => ({
    isOpen: false,
    mode: 'create' as const,
    selectedStatus: null,
    isDeleteConfirmOpen: false,
    pendingDeleteStatusTitle: '',
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    close: vi.fn(),
    save: vi.fn(),
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    setDeleteConfirmOpen: vi.fn(),
  }),
  useNoteModal: () => ({
    isOpen: false,
    cardId: null,
    initialNote: null,
    cardTitle: '',
    open: vi.fn(),
    close: vi.fn(),
    save: vi.fn(),
  }),
  useAddRepositoryCombobox: () => ({
    isOpen: false,
    statusId: null,
    handleOpenChange: vi.fn(),
    openForStatus: vi.fn(),
  }),
  useOptimisticCardAction: () => ({
    executeCardAction: vi.fn(),
  }),
  useRevealLinkedCard: (): void => {},
}))

// Mock child components
vi.mock('@/components/Board/KanbanBoard', () => ({
  KanbanBoard: vi.fn(({ boardId }: { boardId: string }) => (
    <div data-testid="kanban-board">KanbanBoard: {boardId}</div>
  )),
}))

vi.mock('@/components/Board/AddRepositoryCombobox', () => ({
  AddRepositoryCombobox: vi.fn(() => (
    <div data-testid="add-repo-combobox">AddRepositoryCombobox</div>
  )),
}))

vi.mock('@/components/Modals/NoteModal', () => ({
  NoteModal: vi.fn(() => <div data-testid="note-modal">NoteModal</div>),
}))

vi.mock('@/components/Modals/ProjectInfoModal', () => ({
  ProjectInfoModal: vi.fn(() => (
    <div data-testid="project-info-modal">ProjectInfoModal</div>
  )),
}))

vi.mock('@/components/Modals/StatusListDialog', () => ({
  StatusListDialog: vi.fn(() => (
    <div data-testid="status-list-dialog">StatusListDialog</div>
  )),
}))

vi.mock('@/components/Boards/BoardSettingsDialog', () => ({
  BoardSettingsDialog: vi.fn(() => (
    <div data-testid="board-settings-dialog">BoardSettingsDialog</div>
  )),
}))

/**
 * Create a mock Redux store
 */
function createMockStore() {
  return configureStore({
    reducer: {
      board: boardSlice,
      boardSync: boardSyncSlice,
    },
    preloadedState: {
      board: {
        statusLists: [],
        repoCards: [],
      },
    },
  })
}

/**
 * Create a mock Board object
 */
function createMockBoard(overrides?: Partial<Board>): Board {
  return {
    id: 'board-1',
    name: 'Test Board',
    subtitle: null,
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    is_favorite: false,
    settings: null,
    position: 0,
    ...overrides,
  }
}

/**
 * Create mock initial data
 */
function createMockInitialData(
  overrides?: Partial<BoardInitialData>,
): BoardInitialData {
  return {
    statusLists: [
      {
        id: toStatusListId('status-1'),
        title: 'To Do',
        boardId: toBoardId('board-1'),
        gridRow: 0,
        gridCol: 0,
        color: '#6366f1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: toStatusListId('status-2'),
        title: 'Done',
        boardId: toBoardId('board-1'),
        gridRow: 0,
        gridCol: 1,
        color: '#22c55e',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    repoCards: [
      {
        id: toRepoCardId('card-1'),
        title: 'octocat/repo1',
        description: 'Test repo',
        statusId: toStatusListId('status-1'),
        boardId: toBoardId('board-1'),
        repoOwner: 'octocat',
        repoName: 'repo1',
        order: 0,
        meta: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    comments: {},
    ...overrides,
  }
}

describe('BoardPageClient Component', () => {
  let store: ReturnType<typeof createMockStore>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    store = createMockStore()
  })

  describe('Rendering', () => {
    test('should render the board page with header and board name', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        expect(screen.getByText('Test Board')).toBeInTheDocument()
      })
    })

    test('should render Add Column button', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Add Column/i }),
        ).toBeInTheDocument()
      })
    })

    test('should render Board Settings button', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Board Settings/i }),
        ).toBeInTheDocument()
      })
    })

    test('should render KanbanBoard component', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
      })
    })
  })

  describe('Redux Hydration', () => {
    test('should hydrate Redux store with initial status lists', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        const state = store.getState()
        expect(state.board.statusLists).toHaveLength(2)
        expect(state.board.statusLists[0]?.title).toBe('To Do')
        expect(state.board.statusLists[1]?.title).toBe('Done')
      })
    })

    test('should hydrate Redux store with initial repo cards', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        const state = store.getState()
        expect(state.board.repoCards).toHaveLength(1)
        expect(state.board.repoCards[0]?.repoName).toBe('repo1')
      })
    })

    test('shows the cards and columns the server sends when the board is fetched again', async () => {
      // Arrange: the board is on screen with the first server snapshot, and a
      // failed save asks for a fresh copy
      const board = createMockBoard()
      const { rerender } = render(
        <Provider store={store}>
          <BoardPageClient
            board={board}
            initialData={createMockInitialData()}
          />
        </Provider>,
      )
      await waitFor(() => {
        expect(store.getState().board.repoCards).toHaveLength(1)
      })
      act(() => {
        store.dispatch(boardRefreshRequested())
      })
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1)
      })
      const refreshedInitialData = createMockInitialData({
        statusLists: [],
        repoCards: [],
      })

      // Act: router.refresh() delivers a new snapshot as props
      rerender(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={refreshedInitialData} />
        </Provider>,
      )

      // Assert: the store follows the server
      await waitFor(() => {
        expect(store.getState().board.repoCards).toEqual([])
      })
      expect(store.getState().board.statusLists).toEqual([])
    })

    test('keeps a card the user moved while the board was being fetched again', async () => {
      // Arrange: the board is on screen and a fetch is on its way
      const board = createMockBoard()
      const firstInitialData = createMockInitialData()
      const { rerender } = render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={firstInitialData} />
        </Provider>,
      )
      await waitFor(() => {
        expect(store.getState().board.repoCards).toHaveLength(1)
      })
      act(() => {
        store.dispatch(boardRefreshRequested())
      })
      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1)
      })
      // The user drags the card to Done; the save has not come back yet
      const cardInDone = {
        ...firstInitialData.repoCards[0]!,
        statusId: toStatusListId('status-2'),
      }
      act(() => {
        store.dispatch(setRepoCards([cardInDone]))
        void trackBoardWrite(store.dispatch, new Promise<void>(() => undefined))
      })

      // Act: the fetch answers with the card where it was before the drag
      rerender(
        <Provider store={store}>
          <BoardPageClient
            board={board}
            initialData={createMockInitialData()}
          />
        </Provider>,
      )

      // Assert: the card stays where the user put it
      expect(store.getState().board.repoCards).toEqual([cardInDone])
    })
  })

  describe('Dialogs and Modals', () => {
    test('should render StatusListDialog', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('status-list-dialog')).toBeInTheDocument()
      })
    })

    test('should render BoardSettingsDialog', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('board-settings-dialog')).toBeInTheDocument()
      })
    })
  })
})

describe('BoardPageClient Empty State', () => {
  let store: ReturnType<typeof createMockStore>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    store = createMockStore()
  })

  test('should handle empty status lists', async () => {
    const board = createMockBoard()
    const initialData = createMockInitialData({
      statusLists: [],
      repoCards: [],
    })

    render(
      <Provider store={store}>
        <BoardPageClient board={board} initialData={initialData} />
      </Provider>,
    )

    await waitFor(() => {
      const state = store.getState()
      expect(state.board.statusLists).toHaveLength(0)
      expect(state.board.repoCards).toHaveLength(0)
    })
  })
})

describe('BoardPageClient Board Settings', () => {
  let store: ReturnType<typeof createMockStore>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    store = createMockStore()
  })

  test('should render board with custom settings', async () => {
    const board = createMockBoard({
      settings: {
        cardDisplay: {
          showStars: false,
          showLanguage: false,
        },
      },
    })
    const initialData = createMockInitialData()

    render(
      <Provider store={store}>
        <BoardPageClient board={board} initialData={initialData} />
      </Provider>,
    )

    // Component should render
    await waitFor(() => {
      expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
    })
  })
})

describe('BoardPageClient Copy Link', () => {
  let store: ReturnType<typeof createMockStore>
  let originalLocation: Location
  const writeToClipboard = vi.fn(async (_text: string): Promise<void> => {})

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    store = createMockStore()
    // The page is open at the board's own address
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        origin: 'https://gitbox.example',
        href: 'https://gitbox.example/board/board-1',
      },
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeToClipboard },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })

  test('copies the board address and says only the account that owns the board can open it', async () => {
    // Arrange
    render(
      <Provider store={store}>
        <BoardPageClient
          board={createMockBoard()}
          initialData={createMockInitialData()}
        />
      </Provider>,
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: /Copy Link/i }))

    // Assert
    expect(writeToClipboard).toHaveBeenCalledWith(
      'https://gitbox.example/board/board-1',
    )
    expect(toast.success).toHaveBeenCalledWith('Link copied!', {
      description: 'Only the account that owns this board can open it.',
    })
  })

  // Value: protects=Copy Link hands out the board, not the card a link revealed; fails_when=the copied address is the address bar again, which keeps ?card=<id> after the card was revealed; why_new=the other case opens the page without a query; seam=none; no_claim=how the card is revealed (linked-card tests cover it)
  test('copies the board address without the card query of the address bar', async () => {
    // Arrange: the page was opened from a link to one of its cards
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        origin: 'https://gitbox.example',
        href: 'https://gitbox.example/board/board-1?card=card-9',
      },
    })
    render(
      <Provider store={store}>
        <BoardPageClient
          board={createMockBoard()}
          initialData={createMockInitialData()}
        />
      </Provider>,
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: /Copy Link/i }))

    // Assert
    expect(writeToClipboard).toHaveBeenCalledWith(
      'https://gitbox.example/board/board-1',
    )
  })
})

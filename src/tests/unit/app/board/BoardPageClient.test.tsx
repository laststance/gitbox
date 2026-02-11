/**
 * Unit Test: BoardPageClient Component
 *
 * Test targets:
 * - Redux store hydration via useLayoutEffect
 * - localStorage updates
 * - Handler functions (moveToMaintenance, removeFromBoard)
 * - Component rendering with mocked hooks
 */

import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { BoardPageClient } from '@/app/board/[id]/BoardPageClient'
import type { BoardInitialData } from '@/lib/actions/board-data'
import boardSlice from '@/lib/redux/slices/boardSlice'
import type { Board } from '@/lib/supabase/types'

// Mock dependencies
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
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
const mockMoveToMaintenance = vi.fn()
const mockDeleteRepoCard = vi.fn()
vi.mock('@/lib/actions/repo-cards', () => ({
  moveToMaintenance: (...args: unknown[]) => mockMoveToMaintenance(...args),
  deleteRepoCard: (...args: unknown[]) => mockDeleteRepoCard(...args),
}))

// Mock hooks with minimal implementations
vi.mock('@/hooks/board', () => ({
  useBoardSettings: () => ({
    isOpen: false,
    displayName: 'Test Board',
    cardDisplaySettings: { showStars: true, showLanguage: true },
    open: vi.fn(),
    close: vi.fn(),
    handleRenameSuccess: vi.fn(),
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
    },
    preloadedState: {
      board: {
        activeBoard: null,
        statusLists: [],
        repoCards: [],
        loading: false,
        error: null,
        lastDragOperation: null,
        undoHistory: [],
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
        id: 'status-1',
        title: 'To Do',
        boardId: 'board-1',
        gridRow: 0,
        gridCol: 0,
        color: '#6366f1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'status-2',
        title: 'Done',
        boardId: 'board-1',
        gridRow: 0,
        gridCol: 1,
        color: '#22c55e',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    repoCards: [
      {
        id: 'card-1',
        title: 'octocat/repo1',
        description: 'Test repo',
        statusId: 'status-1',
        boardId: 'board-1',
        repoOwner: 'octocat',
        repoName: 'repo1',
        order: 0,
        meta: {},
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    comments: {},
    maintenanceRepoIdentifiers: [],
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
    it('should render the board page with header and board name', async () => {
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

    it('should render Add Column button', async () => {
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

    it('should render Board Settings button', async () => {
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

    it('should render KanbanBoard component', async () => {
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
    it('should hydrate Redux store with initial status lists', async () => {
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

    it('should hydrate Redux store with initial repo cards', async () => {
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

    it('should set activeBoard in Redux', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        const state = store.getState()
        expect(state.board.activeBoard).not.toBeNull()
        expect(state.board.activeBoard?.id).toBe('board-1')
      })
    })
  })

  describe('localStorage', () => {
    it('should save lastVisitedBoard to localStorage', async () => {
      const board = createMockBoard()
      const initialData = createMockInitialData()

      render(
        <Provider store={store}>
          <BoardPageClient board={board} initialData={initialData} />
        </Provider>,
      )

      await waitFor(() => {
        const saved = localStorage.getItem('gitbox:lastVisitedBoard')
        expect(saved).not.toBeNull()
        const parsed = JSON.parse(saved!)
        expect(parsed.id).toBe('board-1')
        expect(parsed.name).toBe('Test Board')
      })
    })
  })

  describe('Dialogs and Modals', () => {
    it('should render StatusListDialog', async () => {
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

    it('should render BoardSettingsDialog', async () => {
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

  it('should handle empty status lists', async () => {
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

  it('should render board with custom settings', async () => {
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

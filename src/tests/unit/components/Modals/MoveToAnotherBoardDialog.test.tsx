/**
 * Unit Tests: Move to Another Board dialog
 *
 * Renders the real dialog with mocked server actions and a real store. The
 * dialog is the way to set a repository aside with its notes, so every state
 * it can show is pinned here: the boards and their columns, a destination
 * board created on the spot, a failed load, a board without columns, a
 * refused move, a finished one, and a request that fails on the way or gets
 * no answer. Where the keyboard focus lands is pinned with each state: the
 * dialog disables its controls while it waits, and a disabled control loses
 * the focus.
 *
 * @see src/components/Modals/MoveToAnotherBoardDialog.tsx
 */

import { configureStore } from '@reduxjs/toolkit'
import * as Sentry from '@sentry/nextjs'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memo, useState } from 'react'
import { Provider, useSelector } from 'react-redux'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { MoveToAnotherBoardDialog } from '@/components/Modals/MoveToAnotherBoardDialog'
import { createBoard } from '@/lib/actions/board'
import {
  getUserBoardsWithStatusLists,
  moveCardToBoard,
} from '@/lib/actions/repo-cards'
import type { BoardOption } from '@/lib/actions/types'
import boardSyncReducer, {
  selectIsBoardRefreshDue,
  selectMayApplyServerSnapshot,
  serverSnapshotApplied,
} from '@/lib/redux/slices/boardSyncSlice'
import settingsReducer from '@/lib/redux/slices/settingsSlice'
import { toBoardId, toRepoCardId, type RepoCardId } from '@/lib/types/brands'
import { reloadPage } from '@/lib/utils/reload-page'

/**
 * `pushRoute`: where the "Open board" action of the success toast navigates to.
 * `showSuccessToast`: stands in for `toast.success`, typed with what the
 * dialog sends, so a test can press the action of the toast.
 */
const { pushRoute, showSuccessToast } = vi.hoisted(() => ({
  pushRoute: vi.fn(),
  showSuccessToast: vi.fn<
    (
      message: string,
      options: {
        description: string
        duration: number
        action: { label: string; onClick: () => void }
      },
    ) => void
  >(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushRoute }),
}))

vi.mock('@/lib/actions/repo-cards', () => ({
  getUserBoardsWithStatusLists: vi.fn(),
  moveCardToBoard: vi.fn(),
}))

vi.mock('@/lib/actions/board', () => ({
  createBoard: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: showSuccessToast },
}))

// A reload would end the test page; the tests check that it was asked for
vi.mock('@/lib/utils/reload-page', () => ({
  reloadPage: vi.fn(),
}))

/** The board the card is on. The dialog never offers it. */
const CURRENT_BOARD: BoardOption = {
  id: 'board-1',
  name: 'Test Board',
  isPublic: false,
  statusLists: [{ id: 'status-11', name: 'Todo', color: '#3b82f6' }],
}

/** Two possible targets: Work Projects (Backlog, In Progress) and Side Projects (Ideas). */
const OTHER_BOARDS: BoardOption[] = [
  {
    id: 'board-2',
    name: 'Work Projects',
    isPublic: false,
    statusLists: [
      { id: 'status-21', name: 'Backlog', color: '#3b82f6' },
      { id: 'status-22', name: 'In Progress', color: '#f59e0b' },
    ],
  },
  {
    id: 'board-3',
    name: 'Side Projects',
    isPublic: false,
    statusLists: [{ id: 'status-31', name: 'Ideas', color: '#10b981' }],
  },
]

/** A board the user shares through a public link, with one column. */
const SHARED_BOARD: BoardOption = {
  id: 'board-5',
  name: 'Portfolio',
  isPublic: true,
  statusLists: [{ id: 'status-51', name: 'Shipped', color: '#10b981' }],
}

/** What `createBoard` answers for a board named Archive made inside the dialog. */
const CREATED_BOARD: BoardOption = {
  id: 'board-9',
  name: 'Archive',
  isPublic: false,
  statusLists: [{ id: 'status-91', name: 'Repositories', color: '#6B7280' }],
}

/**
 * Make the user own the current board plus the given other boards.
 * @param otherBoards - Boards besides the one the card is on.
 */
function mockBoards(otherBoards: BoardOption[] = OTHER_BOARDS): void {
  vi.mocked(getUserBoardsWithStatusLists).mockResolvedValue({
    success: true,
    data: [CURRENT_BOARD, ...otherBoards],
  })
}

/**
 * A store with the two slices the dialog reads and writes.
 * @param rememberedDestinations - Destination of the last move, per source board, as the settings hold it.
 * @returns The store.
 */
function createDialogStore(rememberedDestinations: Record<string, string>) {
  return configureStore({
    reducer: { settings: settingsReducer, boardSync: boardSyncReducer },
    preloadedState: {
      settings: {
        ...settingsReducer(undefined, { type: 'test/init' }),
        moveDestinationByBoard: rememberedDestinations,
      },
    },
  })
}

/**
 * Render the open dialog for the card of laststance/gitbox on board-1.
 * @param rememberedDestinations - Destination of the last move, per source board, as the settings hold it.
 * @returns The callbacks the dialog was given and the store it reads.
 */
function renderOpenDialog(rememberedDestinations: Record<string, string> = {}) {
  const onClose = vi.fn()
  const onMoved = vi.fn()
  const store = createDialogStore(rememberedDestinations)
  render(
    <Provider store={store}>
      <MoveToAnotherBoardDialog
        onClose={onClose}
        cardId={toRepoCardId('card-1')}
        repoName="laststance/gitbox"
        currentBoardId="board-1"
        onMoved={onMoved}
      />
    </Provider>,
  )
  return { onClose, onMoved, store }
}

/**
 * One column with the cards card-1 (laststance/gitbox) and card-2
 * (laststance/docs), and the move dialog open for card-1. As on the board
 * page, a moved card leaves the column and the dialog is gone once it closes.
 *
 * @param isCardGoneAfterRefresh - The board that is fetched again after a
 * move without a confirmation no longer has card-1: the move went through
 * all the same.
 */
const ColumnWithOpenMoveDialog = memo(function ColumnWithOpenMoveDialog({
  isCardGoneAfterRefresh = false,
}: {
  isCardGoneAfterRefresh?: boolean
}) {
  const isBoardRefreshDue = useSelector(selectIsBoardRefreshDue)
  const [isDialogOpen, setIsDialogOpen] = useState(true)
  const [cardsInColumn, setCardsInColumn] = useState([
    { id: toRepoCardId('card-1'), repoName: 'laststance/gitbox' },
    { id: toRepoCardId('card-2'), repoName: 'laststance/docs' },
  ])
  // What the board page shows once it has fetched the board again
  const cardsOnScreen =
    isCardGoneAfterRefresh && isBoardRefreshDue
      ? cardsInColumn.filter((card) => card.id !== toRepoCardId('card-1'))
      : cardsInColumn

  const handleMoved = (movedCardId: RepoCardId): void => {
    setCardsInColumn((cards) => cards.filter((card) => card.id !== movedCardId))
    setIsDialogOpen(false)
  }

  return (
    <>
      <div data-status-column-id="status-11">
        {cardsOnScreen.map((card) => (
          <div
            key={card.id}
            tabIndex={0}
            data-repo-card-id={card.id}
            aria-label={card.repoName}
          />
        ))}
      </div>
      {isDialogOpen && (
        <MoveToAnotherBoardDialog
          onClose={() => setIsDialogOpen(false)}
          cardId={toRepoCardId('card-1')}
          repoName="laststance/gitbox"
          currentBoardId="board-1"
          onMoved={handleMoved}
        />
      )}
    </>
  )
})

describe('MoveToAnotherBoardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Two tests switch to fake timers to let 15 seconds pass
    vi.useRealTimers()
  })

  describe('choosing a destination', () => {
    test('opens on the first other board and its first column when no move was made from this board yet', async () => {
      // Arrange
      mockBoards()

      // Act
      renderOpenDialog()

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Work Projects')
      expect(
        screen.getByRole('combobox', { name: 'Column' }),
      ).toHaveTextContent('Backlog')
    })

    test('opens on the board the last move from this board went to', async () => {
      // Arrange
      mockBoards()

      // Act
      renderOpenDialog({ 'board-1': 'board-3' })

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Side Projects')
      expect(
        screen.getByRole('combobox', { name: 'Column' }),
      ).toHaveTextContent('Ideas')
    })

    test('opens on the first board when the remembered board no longer exists', async () => {
      // Arrange
      mockBoards()

      // Act
      renderOpenDialog({ 'board-1': 'board-deleted' })

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Work Projects')
    })

    test('links to a destination board that has no column and keeps Move disabled', async () => {
      // Arrange
      mockBoards([
        {
          id: 'board-4',
          name: 'Empty Board',
          isPublic: false,
          statusLists: [],
        },
      ])

      // Act
      renderOpenDialog()

      // Assert
      const openBoardLink = await screen.findByRole('link', {
        name: 'Open Empty Board',
      })
      expect(openBoardLink).toHaveAttribute('href', '/board/board-4')
      expect(
        screen.getByText(
          /This board has no columns\. Add columns to the board first\./,
        ),
      ).toBeVisible()
      expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled()
    })

    test('opens on the newest board that is not shared, so no card is made public by the first press of Move', async () => {
      // Arrange: Portfolio, the newest board, is shared by a public link
      mockBoards([SHARED_BOARD, ...OTHER_BOARDS])

      // Act
      renderOpenDialog()

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Work Projects')
      expect(screen.queryByText(/is shared by a public link/)).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Move' }),
      ).not.toHaveAccessibleDescription()
    })

    test('marks a shared board in the list of boards', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([SHARED_BOARD, ...OTHER_BOARDS])
      renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('combobox', { name: 'Board' }))

      // Assert: the mark the board list uses, on the shared board only
      expect(
        await screen.findByRole('option', { name: 'Portfolio Public board' }),
      ).toBeVisible()
      expect(
        screen.getByRole('option', { name: 'Work Projects' }),
      ).toBeVisible()
      expect(screen.getAllByRole('img', { name: 'Public board' })).toHaveLength(
        1,
      )
    })

    test('says who will see the repository once a shared board is picked, and Move is described by that sentence', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([SHARED_BOARD, ...OTHER_BOARDS])
      renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('combobox', { name: 'Board' }))
      await user.click(
        await screen.findByRole('option', { name: 'Portfolio Public board' }),
      )

      // Assert
      expect(
        screen.getByText(
          'Portfolio is shared by a public link. Anyone who has the link will see this repository there, with its description. Notes, links, and comments stay private.',
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('button', { name: 'Move' }),
      ).toHaveAccessibleDescription(
        'Portfolio is shared by a public link. Anyone who has the link will see this repository there, with its description. Notes, links, and comments stay private.',
      )
    })

    test('opens on a shared board when the last move from this board went there, and says that it is shared', async () => {
      // Arrange
      mockBoards([SHARED_BOARD, ...OTHER_BOARDS])

      // Act
      renderOpenDialog({ 'board-1': 'board-5' })

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Portfolio')
      expect(
        screen.getByText(/Portfolio is shared by a public link/),
      ).toBeVisible()
    })

    test('opens on a shared board when the user has no other, and says that it is shared', async () => {
      // Arrange
      mockBoards([SHARED_BOARD])

      // Act
      renderOpenDialog()

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Portfolio')
      expect(
        screen.getByText(/Portfolio is shared by a public link/),
      ).toBeVisible()
    })

    test('puts the keyboard on the Board select once the boards are loaded', async () => {
      // Arrange
      mockBoards()

      // Act
      renderOpenDialog()

      // Assert: the dialog opened while the boards were loading, when Cancel
      // was the only control it could focus
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Board' })).toHaveFocus(),
      )
    })

    test('leaves the keyboard where the user put it while the boards were loading', async () => {
      // Arrange: a load the server answers later; the user goes to the close
      // button in the corner meanwhile
      let answerLoad: (answer: {
        success: true
        data: BoardOption[]
      }) => void = () => {}
      vi.mocked(getUserBoardsWithStatusLists).mockReturnValue(
        new Promise((resolve) => {
          answerLoad = resolve
        }),
      )
      renderOpenDialog()
      const closeButton = await screen.findByRole('button', { name: 'Close' })
      closeButton.focus()

      // Act
      await act(async () => {
        answerLoad({ success: true, data: [CURRENT_BOARD, ...OTHER_BOARDS] })
      })

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).not.toHaveFocus()
      expect(closeButton).toHaveFocus()
    })

    test('says that the boards are loading in a way a screen reader announces', async () => {
      // Arrange: a load the server has not answered yet
      vi.mocked(getUserBoardsWithStatusLists).mockReturnValue(
        new Promise(() => {}),
      )

      // Act
      renderOpenDialog()

      // Assert
      const loadingNotice = (await screen.findByText('Loading boards...'))
        .parentElement
      expect(loadingNotice).toBeVisible()
      expect(loadingNotice).toHaveAttribute('role', 'status')
    })
  })

  describe('after a refused move', () => {
    test('hides the refusal once another target board is chosen', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: false,
        error: 'An unexpected error occurred',
      })
      const { onMoved } = renderOpenDialog()
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'An unexpected error occurred',
      )

      // Act
      await user.click(screen.getByRole('combobox', { name: 'Board' }))
      await user.click(
        await screen.findByRole('option', { name: 'Side Projects' }),
      )

      // Assert
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByRole('combobox', { name: 'Board' })).toHaveTextContent(
        'Side Projects',
      )
      expect(moveCardToBoard).toHaveBeenCalledTimes(1)
      expect(moveCardToBoard).toHaveBeenCalledWith(
        'card-1',
        'board-2',
        'status-21',
      )
      expect(onMoved).not.toHaveBeenCalled()
    })

    test('hides the refusal once another column of the same board is chosen', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: false,
        error: 'An unexpected error occurred',
      })
      const { onMoved } = renderOpenDialog()
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'An unexpected error occurred',
      )

      // Act
      await user.click(screen.getByRole('combobox', { name: 'Column' }))
      await user.click(
        await screen.findByRole('option', { name: 'In Progress' }),
      )

      // Assert
      expect(screen.queryByRole('alert')).toBeNull()
      expect(
        screen.getByRole('combobox', { name: 'Column' }),
      ).toHaveTextContent('In Progress')
      expect(screen.getByRole('combobox', { name: 'Board' })).toHaveTextContent(
        'Work Projects',
      )
      expect(onMoved).not.toHaveBeenCalled()
    })

    test('puts the keyboard back on Move, which was disabled while the move ran', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: false,
        error: 'An unexpected error occurred',
      })
      renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'An unexpected error occurred',
      )
      expect(screen.getByRole('button', { name: 'Move' })).toHaveFocus()
    })
  })

  describe('a finished move', () => {
    test('says where the card went and offers to open that board', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: true,
        data: undefined,
      })
      const { onClose, onMoved } = renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      await waitFor(() => expect(onMoved).toHaveBeenCalledWith('card-1'))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(showSuccessToast).toHaveBeenCalledTimes(1)
      // 8 seconds, not Sonner's 4: time to reach the action by keyboard
      expect(showSuccessToast).toHaveBeenCalledWith('Moved to Work Projects', {
        description: 'laststance/gitbox',
        duration: 8000,
        action: { label: 'Open board', onClick: expect.any(Function) },
      })

      // Pressing the action of the toast opens the destination board
      showSuccessToast.mock.calls[0]?.[1].action.onClick()
      expect(pushRoute).toHaveBeenCalledWith('/board/board-2')
    })

    test('remembers the destination for the next move from this board', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: true,
        data: undefined,
      })
      const { onMoved, store } = renderOpenDialog()
      await user.click(await screen.findByRole('combobox', { name: 'Board' }))
      await user.click(
        await screen.findByRole('option', { name: 'Side Projects' }),
      )

      // Act
      await user.click(screen.getByRole('button', { name: 'Move' }))

      // Assert
      await waitFor(() => expect(onMoved).toHaveBeenCalledWith('card-1'))
      expect(store.getState().settings.moveDestinationByBoard).toEqual({
        'board-1': 'board-3',
      })
    })

    test('stays open when Escape is pressed while the move is still running', async () => {
      // Arrange: a move the server has not answered yet
      const user = userEvent.setup()
      mockBoards()
      let answerMove: (result: {
        success: true
        data: undefined
      }) => void = () => {}
      vi.mocked(moveCardToBoard).mockReturnValue(
        new Promise((resolve) => {
          answerMove = resolve
        }),
      )
      const { onClose, onMoved } = renderOpenDialog()
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      expect(
        await screen.findByRole('button', { name: 'Moving...' }),
      ).toBeDisabled()

      // Act
      await user.keyboard('{Escape}')

      // Assert: still open, and the answer is handled when it arrives
      expect(screen.getByRole('dialog')).toBeVisible()
      expect(onClose).not.toHaveBeenCalled()
      await act(async () => {
        answerMove({ success: true, data: undefined })
      })
      expect(onMoved).toHaveBeenCalledWith('card-1')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('a failed load of the boards', () => {
    test('shows the error with "Try again" and loads the boards once more', async () => {
      // Arrange
      const user = userEvent.setup()
      vi.mocked(getUserBoardsWithStatusLists)
        .mockResolvedValueOnce({
          success: false,
          error: 'An unexpected error occurred',
        })
        .mockResolvedValueOnce({
          success: true,
          data: [CURRENT_BOARD, ...OTHER_BOARDS],
        })
      renderOpenDialog()
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'An unexpected error occurred',
      )
      // A failed load is not "no other board": the create form stays away
      expect(screen.queryByLabelText('Board Name')).toBeNull()
      // The one thing to do next is under the keyboard
      expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()

      // Act
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      // Assert
      const boardSelect = await screen.findByRole('combobox', { name: 'Board' })
      expect(boardSelect).toHaveTextContent('Work Projects')
      expect(boardSelect).toHaveFocus()
      expect(getUserBoardsWithStatusLists).toHaveBeenCalledTimes(2)
    })

    test('shows "Failed to load boards" with a working "Try again" when the request fails on the way', async () => {
      // Arrange
      const user = userEvent.setup()
      vi.mocked(getUserBoardsWithStatusLists)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          success: true,
          data: [CURRENT_BOARD, ...OTHER_BOARDS],
        })
      renderOpenDialog()
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to load boards',
      )

      // Act
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Work Projects')
    })
  })

  describe('creating the destination board', () => {
    test('offers to create a board when the user has no other board, selects the created one and does not load the boards again', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([])
      vi.mocked(createBoard).mockResolvedValue({
        success: true,
        data: CREATED_BOARD,
      })
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: true,
        data: undefined,
      })
      const { onMoved } = renderOpenDialog()
      expect(
        await screen.findByText(
          'You have no other board yet. Create one to move this repository to.',
        ),
      ).toBeVisible()
      // Nothing to go back to
      expect(
        screen.queryByRole('button', { name: 'Choose an existing board' }),
      ).toBeNull()

      // Act
      await user.type(screen.getByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))

      // Assert: the new board and its column are the destination ...
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Archive')
      expect(
        screen.getByRole('combobox', { name: 'Column' }),
      ).toHaveTextContent('Repositories')
      expect(createBoard).toHaveBeenCalledWith('Archive', 'single-column')
      expect(getUserBoardsWithStatusLists).toHaveBeenCalledTimes(1)

      // ... Move is ready under the keyboard and sends the card there
      const moveButton = screen.getByRole('button', { name: 'Move' })
      expect(moveButton).toBeEnabled()
      expect(moveButton).toHaveFocus()
      await user.click(moveButton)
      await waitFor(() => expect(onMoved).toHaveBeenCalledWith('card-1'))
      expect(moveCardToBoard).toHaveBeenCalledWith(
        'card-1',
        'board-9',
        'status-91',
      )
    })

    test('tells a screen reader which board was created and selected, until another board is picked', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(createBoard).mockResolvedValue({
        success: true,
        data: CREATED_BOARD,
      })
      renderOpenDialog()
      await user.click(
        await screen.findByRole('button', { name: 'New Board...' }),
      )
      expect(screen.getByRole('status')).toBeEmptyDOMElement()

      // Act
      await user.type(screen.getByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))

      // Assert: the focus is on Move, which does not name the destination
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Board Archive was created and is selected as the destination.',
      )

      // Picking another board ends the announcement
      await user.click(screen.getByRole('combobox', { name: 'Board' }))
      await user.click(
        await screen.findByRole('option', { name: 'Side Projects' }),
      )
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    test('shows why the board was not created and keeps the typed name', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([])
      vi.mocked(createBoard).mockResolvedValue({
        success: false,
        error: 'The board was not created. Try again.',
      })
      renderOpenDialog()

      // Act
      await user.type(await screen.findByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The board was not created. Try again.',
      )
      const nameField = screen.getByLabelText('Board Name')
      expect(nameField).toHaveValue('Archive')
      // The field was disabled while the request ran and has the keyboard
      // again. The server refused; nothing is wrong with the name.
      expect(nameField).toHaveFocus()
      expect(nameField).toHaveAttribute('aria-invalid', 'false')
      expect(screen.getByRole('button', { name: 'Create Board' })).toBeEnabled()
    })

    test('asks for a name before anything is sent', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([])
      renderOpenDialog()

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Create Board' }),
      )

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Board name is required',
      )
      const nameField = screen.getByLabelText('Board Name')
      expect(nameField).toHaveFocus()
      expect(nameField).toHaveAttribute('aria-invalid', 'true')
      expect(createBoard).not.toHaveBeenCalled()
    })

    test('counts the characters of the name, and a screen reader hears that count and why the form is shown', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([])
      renderOpenDialog()
      const nameField = await screen.findByLabelText('Board Name')

      // Act
      await user.type(nameField, 'Archive')

      // Assert
      expect(screen.getByText('7/50 characters')).toBeVisible()
      expect(nameField).toHaveAccessibleDescription(
        'You have no other board yet. Create one to move this repository to. 7/50 characters',
      )
    })

    test('lists a board created here first, where the server lists it the next time', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(createBoard).mockResolvedValue({
        success: true,
        data: CREATED_BOARD,
      })
      renderOpenDialog()
      await user.click(
        await screen.findByRole('button', { name: 'New Board...' }),
      )
      await user.type(screen.getByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))

      // Act
      await user.click(await screen.findByRole('combobox', { name: 'Board' }))

      // Assert
      const listedBoardNames = (await screen.findAllByRole('option')).map(
        (option) => option.textContent,
      )
      expect(listedBoardNames).toEqual([
        'Archive',
        'Work Projects',
        'Side Projects',
      ])
    })

    test('"New Board..." swaps the selects for the form, with Move disabled, and "Choose an existing board" brings them back', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      renderOpenDialog()

      // Act: ask for a new board although others exist
      await user.click(
        await screen.findByRole('button', { name: 'New Board...' }),
      )

      // Assert: the form has the keyboard and no destination is selected
      expect(screen.getByLabelText('Board Name')).toHaveFocus()
      expect(screen.queryByRole('combobox', { name: 'Board' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled()

      // Act: go back
      await user.click(
        screen.getByRole('button', { name: 'Choose an existing board' }),
      )

      // Assert
      const boardSelect = screen.getByRole('combobox', { name: 'Board' })
      expect(boardSelect).toHaveTextContent('Work Projects')
      expect(boardSelect).toHaveFocus()
      expect(screen.queryByLabelText('Board Name')).toBeNull()
      expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled()
    })

    test('stays open and keeps the way back disabled while the board is being created', async () => {
      // Arrange: a creation the server has not answered yet
      const user = userEvent.setup()
      mockBoards()
      let answerCreation: (result: {
        success: true
        data: BoardOption
      }) => void = () => {}
      vi.mocked(createBoard).mockReturnValue(
        new Promise((resolve) => {
          answerCreation = resolve
        }),
      )
      const { onClose } = renderOpenDialog()
      await user.click(
        await screen.findByRole('button', { name: 'New Board...' }),
      )
      await user.type(screen.getByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))
      expect(
        await screen.findByRole('button', { name: 'Creating...' }),
      ).toBeDisabled()

      // Act
      await user.keyboard('{Escape}')

      // Assert
      expect(screen.getByRole('dialog')).toBeVisible()
      expect(onClose).not.toHaveBeenCalled()
      expect(
        screen.getByRole('button', { name: 'Choose an existing board' }),
      ).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

      // The answer lands in the dialog that asked for it
      await act(async () => {
        answerCreation({ success: true, data: CREATED_BOARD })
      })
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Archive')
    })
  })

  describe('while a move is running', () => {
    test('counts the move as a pending board write until the server answers, so board data fetched meanwhile is held back', async () => {
      // Arrange: the store holds board-1 and the server has not answered yet
      const user = userEvent.setup()
      mockBoards()
      let answerMove: (result: {
        success: true
        data: undefined
      }) => void = () => {}
      vi.mocked(moveCardToBoard).mockReturnValue(
        new Promise((resolve) => {
          answerMove = resolve
        }),
      )
      const { store } = renderOpenDialog()
      store.dispatch(serverSnapshotApplied(toBoardId('board-1')))

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      const mayApplyBoardDataWhileMoving = selectMayApplyServerSnapshot(
        store.getState(),
        toBoardId('board-1'),
      )
      await act(async () => {
        answerMove({ success: true, data: undefined })
      })

      // Assert
      expect(mayApplyBoardDataWhileMoving).toBe(false)
      expect(
        selectMayApplyServerSnapshot(store.getState(), toBoardId('board-1')),
      ).toBe(true)
    })

    test('keeps the board and the column from being changed', async () => {
      // Arrange: a move the server has not answered yet
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockReturnValue(new Promise(() => {}))
      renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      expect(screen.getByRole('combobox', { name: 'Board' })).toBeDisabled()
      expect(screen.getByRole('combobox', { name: 'Column' })).toBeDisabled()
      // The dialog cannot be closed now, so its close button says so
      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'New Board...' }),
      ).toBeDisabled()
    })
  })

  describe('a move with an unknown outcome', () => {
    test('says the move could not be confirmed, has the board fetched again and can be closed when the request fails on the way', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      const networkError = new TypeError('Failed to fetch')
      vi.mocked(moveCardToBoard).mockRejectedValue(networkError)
      const { onClose, onMoved, store } = renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not confirm that the card was moved. Check the board before trying again.',
      )
      expect(onMoved).not.toHaveBeenCalled()
      expect(showSuccessToast).not.toHaveBeenCalled()
      expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
      expect(Sentry.captureException).toHaveBeenCalledWith(networkError, {
        tags: { action: 'moveCardToBoard' },
      })

      // The dialog is not locked any more
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('offers to reload the page when the move could not be confirmed, because the fetch of the board waits for that request', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockRejectedValue(
        new TypeError('Failed to fetch'),
      )
      renderOpenDialog()
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Reload page' }),
      )

      // Assert
      expect(reloadPage).toHaveBeenCalledTimes(1)
    })

    test('puts the keyboard on "Reload page" after a move that could not be confirmed, not on Move', async () => {
      // Arrange: the request fails on the way, so nobody knows where the card is
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockRejectedValue(
        new TypeError('Failed to fetch'),
      )
      renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      expect(
        await screen.findByRole('button', { name: 'Reload page' }),
      ).toHaveFocus()
      expect(screen.getByRole('button', { name: 'Move' })).not.toHaveFocus()
    })

    test('offers no reload for a move the server refused: the board on screen is not in doubt', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: false,
        error: 'An unexpected error occurred',
      })
      renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'An unexpected error occurred',
      )
      expect(screen.queryByRole('button', { name: 'Reload page' })).toBeNull()
    })

    // Value: protects=a move the server itself could not confirm is shown as that, with the way to look at the board; fails_when=the dialog reads every answer of the server as a refusal, or tells this case by its text; why_new=the tests above lose the request in the browser, and the refusal test has an answer without a code; seam=none; no_claim=when the server answers with this code (repo-cards.placement.test.ts)
    test('treats a move the server could not confirm as unknown by the code of its answer, whatever its text says: the keyboard goes to "Reload page" and the board is fetched again', async () => {
      // Arrange: the database gave the server no answer, so the card may have
      // moved. The code under another sentence.
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: false,
        error: 'The move may have gone through.',
        errorCode: 'MOVE_UNCONFIRMED',
      })
      const { onMoved, store } = renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The move may have gone through.',
      )
      expect(screen.getByRole('button', { name: 'Reload page' })).toHaveFocus()
      expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
      expect(onMoved).not.toHaveBeenCalled()
      expect(showSuccessToast).not.toHaveBeenCalled()
    })

    test('stops waiting after 15 seconds without an answer and can be closed again', async () => {
      // Arrange: a move the server never answers
      mockBoards()
      vi.mocked(moveCardToBoard).mockReturnValue(new Promise(() => {}))
      const { onClose, onMoved, store } = renderOpenDialog()
      const moveButton = await screen.findByRole('button', { name: 'Move' })
      vi.useFakeTimers()
      fireEvent.click(moveButton)
      expect(screen.getByRole('button', { name: 'Moving...' })).toBeDisabled()

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not confirm that the card was moved. Check the board before trying again.',
      )
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible()
      expect(onMoved).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled()
      // The board is fetched again right away: after the same 15 seconds the
      // move is no longer counted as a pending write that would hold the
      // fetch back
      expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
      // Nothing is remembered for a move that was not confirmed
      expect(store.getState().settings.moveDestinationByBoard).toEqual({})
      // A request without an answer leaves a trace for the owner
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'moveCardToBoard got no answer in time',
        { level: 'warning', tags: { action: 'moveCardToBoard' } },
      )
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test.each([
      {
        ending: 'the server refuses the move',
        endMove: (): void => {
          vi.mocked(moveCardToBoard).mockResolvedValue({
            success: false,
            error: 'An unexpected error occurred',
          })
        },
      },
      {
        ending: 'the request fails on the way',
        endMove: (): void => {
          vi.mocked(moveCardToBoard).mockRejectedValue(
            new TypeError('Failed to fetch'),
          )
        },
      },
    ])(
      'keeps the remembered destination as it was when $ending',
      async ({ endMove }) => {
        // Arrange: the last move from this board went to Side Projects, and
        // this one is sent to Work Projects
        const user = userEvent.setup()
        mockBoards()
        endMove()
        const { store } = renderOpenDialog({ 'board-1': 'board-3' })
        await user.click(await screen.findByRole('combobox', { name: 'Board' }))
        await user.click(
          await screen.findByRole('option', { name: 'Work Projects' }),
        )

        // Act
        await user.click(screen.getByRole('button', { name: 'Move' }))

        // Assert
        expect(await screen.findByRole('alert')).toBeVisible()
        expect(store.getState().settings.moveDestinationByBoard).toEqual({
          'board-1': 'board-3',
        })
      },
    )

    test('has the board fetched again after a refused move too, because the card may sit elsewhere by now', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: false,
        error: 'An unexpected error occurred',
      })
      const { store } = renderOpenDialog()

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'An unexpected error occurred',
      )
      expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
      // A refusal is an answer: nothing to report
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    test('keeps naming the repository when the board that was fetched again no longer holds the card', async () => {
      // Arrange: the board page reads the name from the cards it holds
      mockBoards()
      const store = createDialogStore({})
      const dialogNamed = (repoName: string) => (
        <Provider store={store}>
          <MoveToAnotherBoardDialog
            onClose={vi.fn()}
            cardId={toRepoCardId('card-1')}
            repoName={repoName}
            currentBoardId="board-1"
            onMoved={vi.fn()}
          />
        </Provider>
      )
      const { rerender } = render(dialogNamed('laststance/gitbox'))
      await screen.findByRole('combobox', { name: 'Board' })

      // Act: the card is gone from the fetched board, so the page has no
      // name left to hand over
      rerender(dialogNamed(''))

      // Assert
      expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
        'Move laststance/gitbox to a different board. Notes, links, and comments will be preserved.',
      )
    })

    test('names the repository in the "Moved to" message of a second try, after the first try took the card off the board', async () => {
      // Arrange: the first try went through without a confirmation, and the
      // board that was fetched again no longer holds the card
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: true,
        data: undefined,
      })
      const store = createDialogStore({})
      const dialogNamed = (repoName: string) => (
        <Provider store={store}>
          <MoveToAnotherBoardDialog
            onClose={vi.fn()}
            cardId={toRepoCardId('card-1')}
            repoName={repoName}
            currentBoardId="board-1"
            onMoved={vi.fn()}
          />
        </Provider>
      )
      const { rerender } = render(dialogNamed('laststance/gitbox'))
      await screen.findByRole('combobox', { name: 'Board' })
      rerender(dialogNamed(''))

      // Act
      await user.click(screen.getByRole('button', { name: 'Move' }))

      // Assert
      await waitFor(() => expect(showSuccessToast).toHaveBeenCalledTimes(1))
      expect(showSuccessToast.mock.calls[0]?.[0]).toBe('Moved to Work Projects')
      expect(showSuccessToast.mock.calls[0]?.[1].description).toBe(
        'laststance/gitbox',
      )
    })
  })

  describe('a board creation with an unknown outcome', () => {
    test('says the creation could not be confirmed and offers to load the boards again in place of a second try, when the request fails on the way', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([])
      const networkError = new TypeError('Failed to fetch')
      vi.mocked(createBoard).mockRejectedValue(networkError)
      renderOpenDialog()

      // Act
      await user.type(await screen.findByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not confirm that the board was created. Check your boards before trying again.',
      )
      // A second try could make a second board: the name stays readable and
      // is not sent again from here
      expect(screen.getByLabelText('Board Name')).toHaveValue('Archive')
      expect(screen.getByLabelText('Board Name')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Create Board' })).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Reload boards' }),
      ).toHaveFocus()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
      expect(Sentry.captureException).toHaveBeenCalledWith(networkError, {
        tags: { action: 'createBoard' },
      })
    })

    test('shows the board that exists after all once the boards are loaded again', async () => {
      // Arrange: the answer was lost on the way, but the server created the
      // board. It lists boards newest first.
      const user = userEvent.setup()
      vi.mocked(getUserBoardsWithStatusLists)
        .mockResolvedValueOnce({ success: true, data: [CURRENT_BOARD] })
        .mockResolvedValueOnce({
          success: true,
          data: [CREATED_BOARD, CURRENT_BOARD],
        })
      vi.mocked(createBoard).mockRejectedValue(new TypeError('Failed to fetch'))
      renderOpenDialog()
      await user.type(await screen.findByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Reload boards' }),
      )

      // Assert: the board is there to move the card to, and was created once
      const boardSelect = await screen.findByRole('combobox', { name: 'Board' })
      expect(boardSelect).toHaveTextContent('Archive')
      expect(boardSelect).toHaveFocus()
      expect(createBoard).toHaveBeenCalledTimes(1)
      expect(getUserBoardsWithStatusLists).toHaveBeenCalledTimes(2)
    })

    test('offers the same when the server itself could not confirm the board', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(createBoard).mockResolvedValue({
        success: false,
        error:
          'Could not confirm that the board was created. Check your boards before trying again.',
        errorCode: 'BOARD_CREATION_UNCONFIRMED',
      })
      renderOpenDialog()
      await user.click(
        await screen.findByRole('button', { name: 'New Board...' }),
      )

      // Act
      await user.type(screen.getByLabelText('Board Name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create Board' }))

      // Assert
      expect(
        await screen.findByRole('button', { name: 'Reload boards' }),
      ).toHaveFocus()
      expect(screen.queryByRole('button', { name: 'Create Board' })).toBeNull()
      // The list this would go back to may lack the board
      expect(
        screen.queryByRole('button', { name: 'Choose an existing board' }),
      ).toBeNull()
      // The server answered: nothing for the browser to report
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    // Value: protects=after a creation that got no answer in time the dialog offers a way out that works; fails_when=it offers "Reload boards", a Server Action that waits behind the creation that is still running, so "Loading boards..." would stay until that request ends; why_new=the test before this change expected "Reload boards" here; seam=none; no_claim=that Next.js queues Server Actions (its documented behavior, not exercised in happy-dom)
    test('stops waiting after 15 seconds without an answer and offers to reload the page, because loading the boards would wait behind the creation that is still running', async () => {
      // Arrange: a creation the server never answers
      const user = userEvent.setup()
      mockBoards([])
      vi.mocked(createBoard).mockReturnValue(new Promise(() => {}))
      const { onClose } = renderOpenDialog()
      await user.type(await screen.findByLabelText('Board Name'), 'Archive')
      vi.useFakeTimers()
      fireEvent.click(screen.getByRole('button', { name: 'Create Board' }))
      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })

      // Assert
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not confirm that the board was created. Check your boards before trying again.',
      )
      expect(screen.getByLabelText('Board Name')).toHaveValue('Archive')
      expect(screen.getByRole('button', { name: 'Reload page' })).toHaveFocus()
      expect(screen.queryByRole('button', { name: 'Reload boards' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Create Board' })).toBeNull()
      // A request without an answer leaves a trace for the owner
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'createBoard got no answer in time',
        { level: 'warning', tags: { action: 'createBoard' } },
      )

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Reload page' }))

      // Assert
      expect(reloadPage).toHaveBeenCalledTimes(1)
      expect(getUserBoardsWithStatusLists).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('keyboard focus once the dialog is gone', () => {
    test('goes to the next card of the column after the card was moved away', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: true,
        data: undefined,
      })
      render(
        <Provider store={createDialogStore({})}>
          <ColumnWithOpenMoveDialog />
        </Provider>,
      )

      // Act
      await user.click(await screen.findByRole('button', { name: 'Move' }))

      // Assert
      await waitFor(() =>
        expect(screen.getByLabelText('laststance/docs')).toHaveFocus(),
      )
      expect(screen.queryByLabelText('laststance/gitbox')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    test('goes back to the card when the dialog is cancelled', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      render(
        <Provider store={createDialogStore({})}>
          <ColumnWithOpenMoveDialog />
        </Provider>,
      )

      // Act
      await user.click(await screen.findByRole('button', { name: 'Cancel' }))

      // Assert
      await waitFor(() =>
        expect(screen.getByLabelText('laststance/gitbox')).toHaveFocus(),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(moveCardToBoard).not.toHaveBeenCalled()
    })

    test('goes to the next card of the column when the dialog is cancelled after a move without a confirmation took the card away all the same', async () => {
      // Arrange: the request fails on the way, and the board that is fetched
      // again no longer has the card
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockRejectedValue(
        new TypeError('Failed to fetch'),
      )
      render(
        <Provider store={createDialogStore({})}>
          <ColumnWithOpenMoveDialog isCardGoneAfterRefresh />
        </Provider>,
      )
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      await screen.findByRole('alert')
      expect(screen.queryByLabelText('laststance/gitbox')).toBeNull()

      // Act
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      // Assert
      await waitFor(() =>
        expect(screen.getByLabelText('laststance/docs')).toHaveFocus(),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    test('goes back to the card when the dialog is cancelled after a move without a confirmation left the card where it was', async () => {
      // Arrange: the request fails on the way, and the board that is fetched
      // again still has the card
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockRejectedValue(
        new TypeError('Failed to fetch'),
      )
      render(
        <Provider store={createDialogStore({})}>
          <ColumnWithOpenMoveDialog />
        </Provider>,
      )
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      await screen.findByRole('alert')

      // Act
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      // Assert
      await waitFor(() =>
        expect(screen.getByLabelText('laststance/gitbox')).toHaveFocus(),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    test('goes to the next card of the column when a second try confirms the move of a card the board no longer shows', async () => {
      // Arrange: the first request fails on the way although the card moved,
      // the board is fetched again without the card, the second request is
      // confirmed
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ success: true, data: undefined })
      render(
        <Provider store={createDialogStore({})}>
          <ColumnWithOpenMoveDialog isCardGoneAfterRefresh />
        </Provider>,
      )
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      await screen.findByRole('alert')
      expect(screen.queryByLabelText('laststance/gitbox')).toBeNull()

      // Act
      await user.click(screen.getByRole('button', { name: 'Move' }))

      // Assert
      await waitFor(() =>
        expect(screen.getByLabelText('laststance/docs')).toHaveFocus(),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(moveCardToBoard).toHaveBeenCalledTimes(2)
    })
  })
})

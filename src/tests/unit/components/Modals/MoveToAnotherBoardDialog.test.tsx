/**
 * Unit Tests: Move to Another Board dialog
 *
 * Renders the real dialog with mocked server actions and a real store. The
 * dialog is the way to set a repository aside with its notes, so every state
 * it can show is pinned here: the boards and their columns, a destination
 * board created on the spot, a failed load, a board without columns, a
 * refused move and a finished one.
 *
 * @see src/components/Modals/MoveToAnotherBoardDialog.tsx
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memo, useState } from 'react'
import { Provider } from 'react-redux'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { MoveToAnotherBoardDialog } from '@/components/Modals/MoveToAnotherBoardDialog'
import { createBoard } from '@/lib/actions/board'
import {
  getUserBoardsWithStatusLists,
  moveCardToBoard,
} from '@/lib/actions/repo-cards'
import type { BoardOption } from '@/lib/actions/types'
import boardSyncReducer from '@/lib/redux/slices/boardSyncSlice'
import settingsReducer from '@/lib/redux/slices/settingsSlice'
import { toRepoCardId, type RepoCardId } from '@/lib/types/brands'

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
        action: { label: string; onClick: () => void }
      },
    ) => void
  >(),
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

/** The board the card is on. The dialog never offers it. */
const CURRENT_BOARD: BoardOption = {
  id: 'board-1',
  name: 'Test Board',
  statusLists: [{ id: 'status-11', name: 'Todo', color: '#3b82f6' }],
}

/** Two possible targets: Work Projects (Backlog, In Progress) and Side Projects (Ideas). */
const OTHER_BOARDS: BoardOption[] = [
  {
    id: 'board-2',
    name: 'Work Projects',
    statusLists: [
      { id: 'status-21', name: 'Backlog', color: '#3b82f6' },
      { id: 'status-22', name: 'In Progress', color: '#f59e0b' },
    ],
  },
  {
    id: 'board-3',
    name: 'Side Projects',
    statusLists: [{ id: 'status-31', name: 'Ideas', color: '#10b981' }],
  },
]

/** What `createBoard` answers for a board named Archive made inside the dialog. */
const CREATED_BOARD: BoardOption = {
  id: 'board-9',
  name: 'Archive',
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
        isOpen
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
 */
const ColumnWithOpenMoveDialog = memo(function ColumnWithOpenMoveDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(true)
  const [cardsInColumn, setCardsInColumn] = useState([
    { id: toRepoCardId('card-1'), repoName: 'laststance/gitbox' },
    { id: toRepoCardId('card-2'), repoName: 'laststance/docs' },
  ])

  const handleMoved = (movedCardId: RepoCardId): void => {
    setCardsInColumn((cards) => cards.filter((card) => card.id !== movedCardId))
    setIsDialogOpen(false)
  }

  return (
    <>
      <div data-status-column-id="status-11">
        {cardsInColumn.map((card) => (
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
          isOpen
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
      mockBoards([{ id: 'board-4', name: 'Empty Board', statusLists: [] }])

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
  })

  describe('after a refused move', () => {
    test('hides the refusal once another target board is chosen', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      vi.mocked(moveCardToBoard).mockResolvedValue({
        success: false,
        error: 'Repository already exists in target board',
      })
      const { onMoved } = renderOpenDialog()
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Repository already exists in target board',
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
        error: 'Repository already exists in target board',
      })
      const { onMoved } = renderOpenDialog()
      await user.click(await screen.findByRole('button', { name: 'Move' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Repository already exists in target board',
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
      expect(showSuccessToast).toHaveBeenCalledWith('Moved to Work Projects', {
        description: 'laststance/gitbox',
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
      expect(screen.queryByLabelText('Board name')).toBeNull()

      // Act
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      // Assert
      expect(
        await screen.findByRole('combobox', { name: 'Board' }),
      ).toHaveTextContent('Work Projects')
      expect(getUserBoardsWithStatusLists).toHaveBeenCalledTimes(2)
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
      await user.type(screen.getByLabelText('Board name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create board' }))

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
      await user.type(await screen.findByLabelText('Board name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create board' }))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The board was not created. Try again.',
      )
      expect(screen.getByLabelText('Board name')).toHaveValue('Archive')
      expect(screen.getByRole('button', { name: 'Create board' })).toBeEnabled()
    })

    test('asks for a name before anything is sent', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards([])
      renderOpenDialog()

      // Act
      await user.click(
        await screen.findByRole('button', { name: 'Create board' }),
      )

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Board name is required',
      )
      expect(createBoard).not.toHaveBeenCalled()
    })

    test('"New board…" swaps the selects for the form, with Move disabled, and "Choose an existing board" brings them back', async () => {
      // Arrange
      const user = userEvent.setup()
      mockBoards()
      renderOpenDialog()

      // Act: ask for a new board although others exist
      await user.click(
        await screen.findByRole('button', { name: 'New board…' }),
      )

      // Assert: the form has the keyboard and no destination is selected
      expect(screen.getByLabelText('Board name')).toHaveFocus()
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
      expect(screen.queryByLabelText('Board name')).toBeNull()
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
        await screen.findByRole('button', { name: 'New board…' }),
      )
      await user.type(screen.getByLabelText('Board name'), 'Archive')
      await user.click(screen.getByRole('button', { name: 'Create board' }))
      expect(
        await screen.findByRole('button', { name: 'Creating…' }),
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
  })
})

/**
 * A held row can move its card onto the board the picker is open on.
 *
 * @see src/components/Board/MoveHereDialog.tsx
 * @see src/components/Board/HeldRepositoryList.tsx
 */

import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { HeldRepositoryList } from '@/components/Board/HeldRepositoryList'
import { moveCardToBoard } from '@/lib/actions/repo-cards'
import type { StatusListDomain } from '@/lib/models/domain'
import boardReducer, { setStatusLists } from '@/lib/redux/slices/boardSlice'
import boardSyncReducer, {
  selectIsBoardRefreshDue,
} from '@/lib/redux/slices/boardSyncSlice'
import { toBoardId, toStatusListId } from '@/lib/types/brands'

vi.mock('@/lib/actions/repo-cards', () => ({
  moveCardToBoard: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

const BOARD_ID = '00000000-0000-4000-8000-0000000000b1'
const CARD_ID = '00000000-0000-4000-8000-0000000000c2'
const TODO_COLUMN_ID = '00000000-0000-4000-8000-0000000000a1'

function makeColumn(
  id: string,
  title: string,
  gridCol: number,
): StatusListDomain {
  return {
    id: toStatusListId(id),
    title,
    color: '#6B7280',
    gridRow: 0,
    gridCol,
    boardId: toBoardId(BOARD_ID),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function renderHeldList() {
  const store = configureStore({
    reducer: { board: boardReducer, boardSync: boardSyncReducer },
  })
  store.dispatch(
    setStatusLists([
      makeColumn(TODO_COLUMN_ID, 'To Do', 0),
      makeColumn('00000000-0000-4000-8000-0000000000a2', 'Done', 1),
    ]),
  )
  const onMoved = vi.fn()
  render(
    <Provider store={store}>
      <HeldRepositoryList
        boardId={toBoardId(BOARD_ID)}
        defaultStatusId={toStatusListId(TODO_COLUMN_ID)}
        onMoved={onMoved}
        repositories={[
          {
            id: 42,
            fullName: 'laststance/gitbox',
            boardId: '00000000-0000-4000-8000-0000000000b2',
            boardName: 'Work Projects',
            cardId: CARD_ID,
          },
        ]}
      />
    </Provider>,
  )
  return { store, onMoved }
}

async function openDialog() {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: 'Move Here, laststance/gitbox' }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Move Here' })
  return { user, dialog }
}

describe('Move Here from a held row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('moves the repository into the column the picker was opened for', async () => {
    // Arrange
    vi.mocked(moveCardToBoard).mockResolvedValue({
      success: true,
      data: undefined,
    })
    const { store, onMoved } = renderHeldList()
    const { user, dialog } = await openDialog()
    expect(
      within(dialog).getByRole('combobox', { name: 'Column' }),
    ).toHaveTextContent('To Do')

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Move Here' }))

    // Assert
    expect(moveCardToBoard).toHaveBeenCalledWith(
      CARD_ID,
      BOARD_ID,
      TODO_COLUMN_ID,
    )
    expect(toast.success).toHaveBeenCalledWith('Moved here', {
      description: 'laststance/gitbox',
    })
    expect(onMoved).toHaveBeenCalledTimes(1)
    expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
    expect(screen.queryByRole('dialog', { name: 'Move Here' })).toBeNull()
  })

  test('says why a refused move did not happen', async () => {
    // Arrange
    vi.mocked(moveCardToBoard).mockResolvedValue({
      success: false,
      error: 'Card not found',
    })
    const { onMoved } = renderHeldList()
    const { user, dialog } = await openDialog()

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Move Here' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Card not found',
    )
    expect(
      within(dialog).getByRole('button', { name: 'Move Here' }),
    ).toHaveFocus()
    expect(onMoved).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  test('offers Reload page when the move could not be confirmed', async () => {
    // Arrange
    vi.mocked(moveCardToBoard).mockResolvedValue({
      success: false,
      error: 'The move may have gone through.',
      errorCode: 'MOVE_UNCONFIRMED',
    })
    const { store, onMoved } = renderHeldList()
    const { user, dialog } = await openDialog()

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Move Here' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The move may have gone through.',
    )
    expect(
      within(dialog).getByRole('button', { name: 'Reload page' }),
    ).toHaveFocus()
    expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
    expect(onMoved).not.toHaveBeenCalled()
  })

  test('stops waiting after 15 seconds without an answer and offers Reload page', async () => {
    // Arrange
    vi.mocked(moveCardToBoard).mockReturnValue(new Promise(() => {}))
    const { store } = renderHeldList()
    const { dialog } = await openDialog()
    const moveButton = within(dialog).getByRole('button', { name: 'Move Here' })
    vi.useFakeTimers()

    // Act
    act(() => {
      moveButton.click()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    // Assert
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Could not confirm that the card was moved. Check the board before trying again.',
    )
    expect(
      within(dialog).getByRole('button', { name: 'Reload page' }),
    ).toHaveFocus()
    expect(selectIsBoardRefreshDue(store.getState())).toBe(true)
    vi.useRealTimers()
  })
})

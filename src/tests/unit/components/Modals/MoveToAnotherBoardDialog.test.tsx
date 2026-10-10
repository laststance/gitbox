/**
 * Unit Tests: Move to Another Board dialog forgets a refusal once the target changes
 *
 * Renders the real dialog with mocked server actions. A move the server
 * refused (the target board already holds the repository) shows an alert that
 * is only true for that target, so choosing another board or another column
 * must hide it.
 *
 * @see src/components/Modals/MoveToAnotherBoardDialog.tsx
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { MoveToAnotherBoardDialog } from '@/components/Modals/MoveToAnotherBoardDialog'
import {
  getUserBoardsWithStatusLists,
  moveCardToBoard,
} from '@/lib/actions/repo-cards'
import { toRepoCardId } from '@/lib/types/brands'

vi.mock('@/lib/actions/repo-cards', () => ({
  getUserBoardsWithStatusLists: vi.fn(),
  moveCardToBoard: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

/**
 * Make the user own three boards: the current one (Test Board) and two possible
 * targets, Work Projects (Backlog, In Progress) and Side Projects (Ideas).
 */
function mockBoards(): void {
  vi.mocked(getUserBoardsWithStatusLists).mockResolvedValue({
    success: true,
    data: [
      {
        id: 'board-1',
        name: 'Test Board',
        statusLists: [{ id: 'status-11', name: 'Todo', color: '#3b82f6' }],
      },
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
    ],
  })
}

/** Render the open dialog for the card of laststance/gitbox on board-1. */
function renderOpenDialog() {
  const onClose = vi.fn()
  const onMoved = vi.fn()
  render(
    <MoveToAnotherBoardDialog
      isOpen
      onClose={onClose}
      cardId={toRepoCardId('card-1')}
      repoName="laststance/gitbox"
      currentBoardId="board-1"
      onMoved={onMoved}
    />,
  )
  return { onClose, onMoved }
}

describe('MoveToAnotherBoardDialog after a refused move', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    await user.click(await screen.findByRole('option', { name: 'In Progress' }))

    // Assert
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Column' })).toHaveTextContent(
      'In Progress',
    )
    expect(screen.getByRole('combobox', { name: 'Board' })).toHaveTextContent(
      'Work Projects',
    )
    expect(onMoved).not.toHaveBeenCalled()
  })
})

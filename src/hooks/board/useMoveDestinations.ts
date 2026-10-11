/**
 * useMoveDestinations Hook
 *
 * Loads the boards a card can be moved to and keeps that list for
 * {@link MoveToAnotherBoardDialog}: loading, a failed load that can be tried
 * again, and a board created inside the dialog, which is added to the list
 * without loading it a second time.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getUserBoardsWithStatusLists } from '@/lib/actions/repo-cards'
import type { BoardOption } from '@/lib/actions/types'

/**
 * What the dialog knows about the possible destinations.
 * - `loading`: the boards are on their way
 * - `failed`: they could not be loaded; `message` is shown with "Try again"
 * - `ready`: `boards` holds the user's boards without the one the card is on
 *   (empty when the user has no other board)
 */
export type MoveDestinations =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; boards: BoardOption[] }

/** Shown when the load fails without a message of its own. */
const LOAD_FAILED_MESSAGE = 'Failed to load boards'

/**
 * Loads the destinations of a move when the dialog opens. Exists so the
 * dialog renders from one value instead of juggling a list, a loading flag
 * and an error. Called once by {@link MoveToAnotherBoardDialog}, whose body
 * is mounted for each opening, so every opening starts with a fresh load.
 *
 * @param currentBoardId - Board the card is on; it is left out of the list.
 * @returns
 * - `destinations`: the {@link MoveDestinations} to render
 * - `reloadDestinations`: loads again after a failed load ("Try again")
 * - `addDestination`: puts a board created inside the dialog on the list.
 *   The list is not loaded again, so a created board is never followed by a
 *   failed load that would hide it.
 * @example
 * const { destinations, reloadDestinations, addDestination } =
 *   useMoveDestinations('board-uuid-456')
 * // destinations => { status: 'ready', boards: [{ id: 'board-uuid-789', name: 'Work', statusLists: [...] }] }
 */
export function useMoveDestinations(currentBoardId: string): {
  destinations: MoveDestinations
  reloadDestinations: () => void
  addDestination: (board: BoardOption) => void
} {
  // Every board of the user, the current one included, as the server sent them
  const [loadedBoards, setLoadedBoards] = useState<MoveDestinations>({
    status: 'loading',
  })
  // Goes up on every "Try again"; a new value runs the load once more
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    // Set when the dialog closes or a newer load starts: a late answer must
    // not replace what is on screen by then
    let isCancelled = false

    const loadBoards = async (): Promise<void> => {
      try {
        const result = await getUserBoardsWithStatusLists()
        if (isCancelled) return

        setLoadedBoards(
          result.success
            ? { status: 'ready', boards: result.data }
            : {
                status: 'failed',
                message: result.error || LOAD_FAILED_MESSAGE,
              },
        )
      } catch {
        // The request itself failed (offline, server unreachable)
        if (!isCancelled) {
          setLoadedBoards({ status: 'failed', message: LOAD_FAILED_MESSAGE })
        }
      }
    }

    loadBoards()

    return (): void => {
      isCancelled = true
    }
  }, [loadAttempt])

  // A card cannot be moved to the board it is already on
  const destinations = useMemo<MoveDestinations>(
    () =>
      loadedBoards.status === 'ready'
        ? {
            status: 'ready',
            boards: loadedBoards.boards.filter(
              (board) => board.id !== currentBoardId,
            ),
          }
        : loadedBoards,
    [loadedBoards, currentBoardId],
  )

  const reloadDestinations = useCallback(() => {
    setLoadedBoards({ status: 'loading' })
    setLoadAttempt((attempt) => attempt + 1)
  }, [])

  const addDestination = useCallback((board: BoardOption) => {
    setLoadedBoards((current) => ({
      status: 'ready',
      boards: current.status === 'ready' ? [...current.boards, board] : [board],
    }))
  }, [])

  return { destinations, reloadDestinations, addDestination }
}

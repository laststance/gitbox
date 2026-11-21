/**
 * RepoCard Actions
 *
 * Execute RepoCard (GitHub Repository Card) CRUD operations with server actions
 * - Add repository to board
 * - Check duplicates
 * - Update quick note
 * - Delete card
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import {
  withAuthResult,
  withAuthResultRateLimit,
} from '@/lib/actions/auth-guard'
import type { GitHubRepository } from '@/lib/actions/github'
import { BOARD_OF_CARD_RELATION } from '@/lib/constants/board-bundle'
import { MOVE_UNCONFIRMED_MESSAGE } from '@/lib/constants/card-move'
import { createModuleLogger } from '@/lib/logger'
import { didDatabaseRefuse } from '@/lib/utils/did-database-refuse'
import { readEveryRow } from '@/lib/utils/read-every-row'

import type { SkippedRepository } from './repo-card-duplicates'
import {
  addRepositoriesToBoardCore,
  type CreatedRepoCard,
} from './repo-cards-core'
import { ActionUserError, type ActionResult, type BoardOption } from './types'

// The picker's `onRepositoriesAdded` types its cards with this; it lives in
// `repo-cards-core.ts` so the MCP route can name it too (types are not
// browser-callable endpoints — see browser-callable-actions.test.ts).
export type { CreatedRepoCard } from './repo-cards-core'

const log = createModuleLogger('repo-cards')

/**
 * Add multiple repositories to board
 *
 * A repository can sit on at most one of the user's boards (Issue #215).
 * Repositories that are already placed are not an error: they come back in
 * `skipped`, each with the sentence to show. Called by the Add Repositories
 * picker.
 *
 * @param boardId - Target board ID
 * @param statusId - Initial status (column) ID
 * @param repositories - List of GitHub repositories to add
 * @returns
 * - Some or all added: `{ success: true, data: { addedCount, cards, skipped } }`
 * - Every repository already placed: `{ success: true, data: { addedCount: 0, cards: [], skipped } }`
 * - Lost a race with another tab: `{ success: false, error: ADD_RACE_MESSAGE }` (nothing added)
 * - More than `MAX_REPOSITORIES_PER_ADD` repositories: `{ success: false, error: TOO_MANY_REPOSITORIES_MESSAGE }`
 * - Anything else: `{ success: false, error: 'An unexpected error occurred' }`
 * @example
 * const result = await addRepositoriesToBoard(boardId, statusId, repos)
 * if (result.success) {
 *   // `comment` goes to the comment map; the rest is the card in Redux
 *   const cards = result.data.cards.map(({ comment: _comment, ...card }) => card)
 *   dispatch(addRepoCards(cards))
 *   result.data.skipped // => [{ fullName: 'a/b', reason: 'other-board', message: 'a/b is already on board "Work"', ... }]
 * }
 */
export async function addRepositoriesToBoard(
  boardId: string,
  statusId: string,
  repositories: GitHubRepository[],
): Promise<
  ActionResult<{
    addedCount: number
    cards: CreatedRepoCard[]
    skipped: SkippedRepository[]
  }>
> {
  // The work itself lives in `repo-cards-core.ts`, which the MCP route calls
  // too; this endpoint only adds the auth guard, the rate limit and the
  // cookie-bound context.
  return withAuthResultRateLimit('addReposToBoard', async (supabase, claims) =>
    addRepositoriesToBoardCore({
      supabase,
      userId: claims.sub,
      boardId,
      statusId,
      repos: repositories,
    }),
  )
}

/**
 * Delete RepoCard
 *
 * @param cardId - Card ID
 * @returns Deletion success flag
 */
export async function deleteRepoCard(
  cardId: string,
): Promise<ActionResult<void>> {
  return withAuthResultRateLimit('boardCrud', async (supabase) => {
    // Delete card (ownership check is done automatically by RLS policy)
    const { error: deleteError } = await supabase
      .from('repocard')
      .delete()
      .eq('id', cardId)

    if (deleteError) {
      log.error({ error: deleteError }, 'Delete card error')
      Sentry.captureException(deleteError, {
        extra: { context: 'Delete card', cardId },
      })
      throw new Error('Failed to delete card')
    }
  })
}

/**
 * Get all boards for the current user with their status lists
 *
 * Used by {@link MoveToAnotherBoardDialog}, through {@link useMoveDestinations},
 * to show the boards a card can be moved to and their columns.
 *
 * @returns
 * - On success: `{ success: true, data: BoardOption[] }`, every board of the
 *   user, newest first, with its columns in the order the board page shows
 *   them (grid row, then grid column). Newest first on purpose: the dialog
 *   opens on the newest board when no move was made from this board yet,
 *   and the board made last is the likeliest destination.
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 *
 * @example
 * const result = await getUserBoardsWithStatusLists()
 * if (result.success) {
 *   result.data.forEach(board => {
 *     console.log(board.name, board.statusLists.length, 'columns')
 *   })
 * }
 */
export async function getUserBoardsWithStatusLists(): Promise<
  ActionResult<BoardOption[]>
> {
  return withAuthResult(async (supabase, claims) => {
    const boards = await readEveryRow((from, to) =>
      supabase
        .from('board')
        .select('id, name')
        .eq('user_id', claims.sub)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    )

    if (boards.length === 0) {
      return []
    }

    // Columns of every board, in the order the board page shows them.
    // Dragging a column changes grid_row and grid_col and leaves "order"
    // as it was at creation, so "order" would list them differently.
    // `id` is the tiebreak so a later page does not repeat a column.
    const boardIds = boards.map((b) => b.id)
    const statusLists = await readEveryRow((from, to) =>
      supabase
        .from('statuslist')
        .select('id, name, color, board_id')
        .in('board_id', boardIds)
        .order('grid_row', { ascending: true })
        .order('grid_col', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    )

    // Group status lists by board
    const statusListsByBoard = new Map<string, BoardOption['statusLists']>()
    for (const sl of statusLists) {
      const existing = statusListsByBoard.get(sl.board_id) || []
      existing.push({ id: sl.id, name: sl.name, color: sl.color ?? '#6B7280' })
      statusListsByBoard.set(sl.board_id, existing)
    }

    // Build result
    return boards.map((board) => ({
      id: board.id,
      name: board.name,
      statusLists: statusListsByBoard.get(board.id) || [],
    }))
  })
}

/**
 * Move a RepoCard to another board
 *
 * Transfers a repository card from the current board to a different board.
 * The note, links and comment stay with the repository (issue #216), so they
 * are on the card at its new place as they were.
 *
 * Sending the same move again is harmless: a card that is already on the
 * target board is put at the end of the chosen column once more. A move whose
 * answer was lost on the way can therefore simply be repeated.
 *
 * @param cardId - RepoCard ID to move
 * @param targetBoardId - Destination board ID
 * @param targetStatusId - Destination status column ID
 * @returns
 * - On success: `{ success: true }`
 * - On a malformed id: `{ success: false, error: 'Invalid ID format' }`
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - When the database gave no answer to the move itself, so the card may
 *   have moved: `{ success: false, error: MOVE_UNCONFIRMED_MESSAGE,
 *   errorCode: 'MOVE_UNCONFIRMED' }`
 * - On anything else (card or board not found, not the owner, column of
 *   another board, a move the database refused):
 *   `{ success: false, error: 'An unexpected error occurred' }`
 *
 * @example
 * const result = await moveCardToBoard('card-uuid', 'board-uuid', 'status-uuid')
 * if (result.success) {
 *   // Leaves the store only while it still holds the board the card came from
 *   dispatch(removeMovedRepoCard(sourceBoardId, 'card-uuid'))
 * }
 */
export async function moveCardToBoard(
  cardId: string,
  targetBoardId: string,
  targetStatusId: string,
): Promise<ActionResult<void>> {
  // Step 0: Validate UUID format
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (
    !UUID_RE.test(cardId) ||
    !UUID_RE.test(targetBoardId) ||
    !UUID_RE.test(targetStatusId)
  ) {
    return { success: false, error: 'Invalid ID format' }
  }

  return withAuthResultRateLimit('boardCrud', async (supabase, claims) => {
    // Fetch card with board ownership check
    const { data: card, error: cardError } = await supabase
      .from('repocard')
      .select(`*, ${BOARD_OF_CARD_RELATION}(user_id)`)
      .eq('id', cardId)
      .single()

    if (cardError || !card) {
      throw new Error('Card not found')
    }

    // Verify ownership via board's user_id
    const boardData = card.board as { user_id: string } | null
    if (!boardData || boardData.user_id !== claims.sub) {
      throw new Error('Unauthorized')
    }

    // Verify target board exists and user owns it
    const { data: targetBoard, error: targetBoardError } = await supabase
      .from('board')
      .select('id')
      .eq('id', targetBoardId)
      .eq('user_id', claims.sub)
      .single()

    if (targetBoardError || !targetBoard) {
      throw new Error('Target board not found')
    }

    // Verify target status belongs to target board
    const { data: targetStatus, error: targetStatusError } = await supabase
      .from('statuslist')
      .select('id')
      .eq('id', targetStatusId)
      .eq('board_id', targetBoardId)
      .single()

    if (targetStatusError || !targetStatus) {
      throw new Error('Status column does not belong to target board')
    }

    // No look into the target board for the same repository, and no answer
    // of its own for a unique violation: a user has one card per repository
    // (repocard_unique_repo_per_user) and the card stays with its owner, so
    // the only card of this repository the target board can hold is this one,
    // already moved by a request whose answer was lost. The function below
    // moves it again without harm.

    // Atomic move via RPC (calculates next order position)
    const failure = await supabase
      .rpc('move_card_to_board', {
        p_card_id: cardId,
        p_target_board_id: targetBoardId,
        p_target_status_id: targetStatusId,
      })
      .then(
        ({ error }) =>
          error && { cause: error, isRefusal: didDatabaseRefuse(error) },
        // The client answers with an error and does not throw. If something
        // throws all the same, the request may be on its way.
        (thrown: unknown) => ({ cause: thrown, isRefusal: false }),
      )

    if (failure) {
      log.error({ error: failure.cause }, 'move_card_to_board RPC error')
      Sentry.captureException(failure.cause, {
        extra: { context: 'move_card_to_board RPC', cardId, targetBoardId },
      })
      // The function moves the card in one transaction. Only a code of the
      // database proves that it did not: without one the card may have moved.
      if (!failure.isRefusal) {
        throw new ActionUserError(MOVE_UNCONFIRMED_MESSAGE, 'MOVE_UNCONFIRMED')
      }
      throw new Error('Failed to move card')
    }
  })
}

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
import { MOVE_UNCONFIRMED_MESSAGE } from '@/lib/constants/card-move'
import { createModuleLogger } from '@/lib/logger'
import {
  toBoardId,
  toRepoCardId,
  toStatusListId,
  type BoardId,
  type RepoCardId,
  type StatusListId,
} from '@/lib/types/brands'
import type { ISOTimestamp, Visibility } from '@/lib/types/domain-primitives'
import { didDatabaseRefuse } from '@/lib/utils/did-database-refuse'
import { addRepositoriesRequestSchema } from '@/lib/validations/repo-card'

import { REPO_CARD_COLUMNS } from './mappers'
import {
  ADD_RACE_MESSAGE,
  isUniqueViolation,
  lookupRepoPlacements,
  splitRequestedRepos,
  toUniqueViolationError,
  type SkippedRepository,
} from './repo-card-duplicates'
import { ActionUserError, type ActionResult, type BoardOption } from './types'

const log = createModuleLogger('repo-cards')

/**
 * Server-authored card data returned from {@link addRepositoriesToBoard}.
 * Shaped for direct consumption by Redux optimistic updates (see
 * `BoardPageClient`'s `onRepositoriesAdded`), which maps these into
 * `RepoCardForRedux` items.
 *
 * @example
 * {
 *   id: 'uuid' as RepoCardId,
 *   boardId: 'uuid' as BoardId,
 *   statusId: 'uuid' as StatusListId,
 *   repoOwner: 'laststance',
 *   repoName: 'gitbox',
 *   order: 0,
 *   meta: { stars: 42, language: 'TypeScript', visibility: 'public' },
 *   createdAt: '2026-04-21T12:00:00Z',
 *   updatedAt: '2026-04-21T12:00:00Z',
 * }
 */
export interface CreatedRepoCard {
  /** Newly-inserted {@link RepoCardId}. */
  id: RepoCardId
  /** Parent {@link BoardId}. */
  boardId: BoardId
  /** Initial column (`statuslist.id`) the card lives in. */
  statusId: StatusListId
  /** GitHub repository owner login. */
  repoOwner: string
  /** GitHub repository name. */
  repoName: string
  /** Display order within the column (0-indexed). */
  order: number
  /** Snapshot of GitHub metadata (subset of `RepoCardMeta`). */
  meta: {
    stars?: number
    language?: string | null
    topics?: string[]
    visibility?: Visibility
    description?: string | null
    updatedAt?: ISOTimestamp
    githubId?: number
  }
  /** Creation timestamp (ISO-8601 UTC). */
  createdAt: ISOTimestamp
  /** Last update timestamp (ISO-8601 UTC). */
  updatedAt: ISOTimestamp
}

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
 *   dispatch(addRepoCards(result.data.cards)) // Optimistic update
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
  return withAuthResultRateLimit(
    'addReposToBoard',
    async (supabase, claims) => {
      // Reject a malformed identity (id, owner, name) before any query: owner
      // and name are echoed back in messages and stored on the card. Display
      // metadata (stars, topics, ...) is not validated here.
      const parsedRequest = addRepositoriesRequestSchema.safeParse(repositories)
      if (!parsedRequest.success) {
        // The picker has no selection cap, so an oversized batch is a user
        // mistake worth explaining (the schema carries the sentence);
        // anything else is a malformed request
        const tooManyRepositoriesIssue = parsedRequest.error.issues.find(
          (issue) => issue.code === 'too_big' && issue.path.length === 0,
        )
        throw tooManyRepositoriesIssue
          ? new ActionUserError(tooManyRepositoriesIssue.message)
          : new Error('Invalid repositories payload')
      }

      // Check if board exists and user owns it
      const { data: board, error: boardError } = await supabase
        .from('board')
        .select('id, user_id')
        .eq('id', boardId)
        .eq('user_id', claims.sub)
        .single()

      if (boardError || !board) {
        throw new Error('Board not found')
      }

      // Where every repository of this user already lives (all boards).
      // Throws on lookup failure: never insert without it.
      const placements = await lookupRepoPlacements(supabase, claims.sub)

      const { addable: newRepos, skipped } = splitRequestedRepos(
        repositories,
        placements,
        boardId,
      )

      // Everything is already placed: not an error, the picker explains why
      if (newRepos.length === 0) {
        return { addedCount: 0, cards: [], skipped }
      }

      // Get current maximum order value
      const { data: maxOrderData } = await supabase
        .from('repocard')
        .select('order')
        .eq('status_id', statusId)
        .order('order', { ascending: false })
        .limit(1)
        .single()

      let nextOrder = (maxOrderData?.order ?? -1) + 1

      // Add new cards
      const cardsToInsert = newRepos.map((repo) => ({
        board_id: boardId,
        status_id: statusId,
        repo_owner: repo.owner.login,
        repo_name: repo.name,
        order: nextOrder++,
        meta: {
          stars: repo.stargazers_count,
          language: repo.language,
          topics: repo.topics || [],
          visibility: repo.visibility,
          description: repo.description,
          updatedAt: repo.updated_at,
          // Untrusted client hint for a later rename-safe identity backfill:
          // re-verify against the GitHub API before relying on it
          githubId: repo.id,
        },
      }))

      const { data: insertedCards, error: insertError } = await supabase
        .from('repocard')
        .insert(cardsToInsert)
        .select(REPO_CARD_COLUMNS)

      if (insertError) {
        // Another tab placed one of these repositories after the lookup. The
        // batch insert is atomic, so nothing was added.
        if (isUniqueViolation(insertError)) {
          throw toUniqueViolationError({
            error: insertError,
            raceMessage: ADD_RACE_MESSAGE,
            action: 'addRepositoriesToBoard',
            userId: claims.sub,
          })
        }

        log.error({ error: insertError }, 'RepoCard insert error')
        Sentry.captureException(insertError, {
          extra: { context: 'RepoCard insert', boardId },
        })
        throw new Error('Failed to add cards: ' + insertError.message)
      }

      // Transform database response to CreatedRepoCard format
      const createdCards: CreatedRepoCard[] = (insertedCards || []).map(
        (card) => ({
          id: toRepoCardId(card.id),
          boardId: toBoardId(card.board_id),
          statusId: toStatusListId(card.status_id),
          repoOwner: card.repo_owner,
          repoName: card.repo_name,
          order: card.order,
          meta: card.meta as CreatedRepoCard['meta'],
          createdAt: card.created_at ?? new Date().toISOString(),
          updatedAt: card.updated_at ?? new Date().toISOString(),
        }),
      )

      return {
        addedCount: createdCards.length,
        cards: createdCards,
        skipped,
      }
    },
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
 *   opens on the first board that is not shared when no move was made from
 *   this board yet, and the board made last is the likeliest destination.
 *   `isPublic` says whether the board is shared through a public link, so
 *   the dialog can say that a card moved there becomes readable through it.
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
    // Fetch boards
    const { data: boards, error: boardsError } = await supabase
      .from('board')
      .select('id, name, is_public')
      .eq('user_id', claims.sub)
      .order('created_at', { ascending: false })

    if (boardsError) {
      log.error({ error: boardsError }, 'Failed to fetch boards')
      throw new Error('Failed to fetch boards')
    }

    if (!boards || boards.length === 0) {
      return []
    }

    // Fetch status lists for all boards, in the order the board page shows
    // them. Dragging a column changes grid_row and grid_col and leaves
    // "order" as it was at creation, so "order" would list them differently.
    const boardIds = boards.map((b) => b.id)
    const { data: statusLists, error: statusError } = await supabase
      .from('statuslist')
      .select('id, name, color, board_id')
      .in('board_id', boardIds)
      .order('grid_row', { ascending: true })
      .order('grid_col', { ascending: true })

    if (statusError) {
      log.error({ error: statusError }, 'Failed to fetch status lists')
      throw new Error('Failed to fetch status lists')
    }

    // Group status lists by board
    const statusListsByBoard = new Map<string, BoardOption['statusLists']>()
    for (const sl of statusLists || []) {
      const existing = statusListsByBoard.get(sl.board_id) || []
      existing.push({ id: sl.id, name: sl.name, color: sl.color ?? '#6B7280' })
      statusListsByBoard.set(sl.board_id, existing)
    }

    // Build result
    return boards.map((board) => ({
      id: board.id,
      name: board.name,
      isPublic: board.is_public,
      statusLists: statusListsByBoard.get(board.id) || [],
    }))
  })
}

/**
 * Move a RepoCard to another board
 *
 * Transfers a repository card from the current board to a different board.
 * The card ID is preserved, so all projectinfo (notes, links, comments) remains intact.
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
      .select('*, board:board_id(user_id)')
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

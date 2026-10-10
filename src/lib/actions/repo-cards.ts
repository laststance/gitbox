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
import {
  addRepositoriesRequestSchema,
  MAX_REPOSITORIES_PER_ADD,
  TOO_MANY_REPOSITORIES_MESSAGE,
} from '@/lib/validations/repo-card'

import {
  ADD_RACE_MESSAGE,
  findBoardPlacement,
  isUniqueViolation,
  lookupRepoPlacements,
  splitRequestedRepos,
  toDialogRaceMessage,
  toUniqueViolationError,
  type SkippedRepository,
} from './repo-card-duplicates'
import { ActionUserError, type ActionResult } from './types'

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
 * A repository can sit on at most one of the user's boards and never on a
 * board and in Maintenance at once (Issue #215). Repositories that are already
 * placed are not an error: they come back in `skipped`, each with the sentence
 * to show. Called by the Add Repositories picker.
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
      // The picker has no selection cap, so an oversized batch is a user
      // mistake worth explaining rather than an unexpected error
      if (
        Array.isArray(repositories) &&
        repositories.length > MAX_REPOSITORIES_PER_ADD
      ) {
        throw new ActionUserError(TOO_MANY_REPOSITORIES_MESSAGE)
      }

      // Reject a malformed identity (id, owner, name) before any query: owner
      // and name are echoed back in messages and stored on the card. Display
      // metadata (stars, topics, ...) is not validated here.
      if (!addRepositoriesRequestSchema.safeParse(repositories).success) {
        throw new Error('Invalid repositories payload')
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

      // Where every repository of this user already lives (all boards +
      // maintenance). Throws on lookup failure: never insert without it.
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
        .select(
          'id, board_id, status_id, repo_owner, repo_name, order, meta, created_at, updated_at',
        )

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
 * Restore a maintenance item back to a board
 *
 * Transfers a repository from the maintenance archive back to an active board.
 * Creates a new RepoCard in the specified status column and removes the maintenance entry.
 *
 * @param maintenanceId - Maintenance record ID
 * @param boardId - Target board ID
 * @param statusId - Target status list ID (column)
 * @returns
 * - On success: `{ success: true, data: { cardId: string } }`
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - On duplicate: `{ success: false, error: 'owner/name is already on board "<board name>"' }`
 *   (the repository sits on any of the user's boards, Issue #215)
 * - On a lost race: `{ success: false, error: 'owner/name was just placed on a board. Close this dialog and try again.' }`
 * - On anything else: `{ success: false, error: 'An unexpected error occurred' }`
 *
 * @example
 * const result = await restoreToBoard('maint-uuid-123', 'board-uuid-456', 'status-uuid-789')
 * if (result.success) {
 *   console.log('Restored to board, new card:', result.data.cardId)
 * } else {
 *   console.error('Failed:', result.error)
 * }
 */
export async function restoreToBoard(
  maintenanceId: string,
  boardId: string,
  statusId: string,
): Promise<ActionResult<{ cardId: string }>> {
  return withAuthResultRateLimit('boardCrud', async (supabase, claims) => {
    // Fetch maintenance item with ownership check
    const { data: maintItem, error: maintError } = await supabase
      .from('maintenance')
      .select('*')
      .eq('id', maintenanceId)
      .eq('user_id', claims.sub)
      .single()

    if (maintError || !maintItem) {
      throw new Error('Maintenance item not found')
    }

    // Verify board ownership
    const { data: board, error: boardError } = await supabase
      .from('board')
      .select('id')
      .eq('id', boardId)
      .eq('user_id', claims.sub)
      .single()

    if (boardError || !board) {
      throw new Error('Board not found')
    }

    // Reject when the repository already sits on ANY board of this user.
    // Throws on lookup failure: never restore without it.
    const placements = await lookupRepoPlacements(supabase, claims.sub)
    const holdingBoard = findBoardPlacement(
      placements,
      maintItem.repo_owner,
      maintItem.repo_name,
    )

    if (holdingBoard) {
      throw new ActionUserError(
        `${maintItem.repo_owner}/${maintItem.repo_name} is already on board "${holdingBoard.boardName}"`,
      )
    }

    // Get max order in target status
    const { data: maxOrderData } = await supabase
      .from('repocard')
      .select('order')
      .eq('status_id', statusId)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (maxOrderData?.order ?? -1) + 1

    // Atomic transaction: insert repocard → transfer projectinfo FK → delete maintenance
    const { data: cardId, error: rpcError } = await supabase.rpc(
      'restore_to_board',
      {
        p_maintenance_id: maintenanceId,
        p_board_id: boardId,
        p_status_id: statusId,
        p_repo_owner: maintItem.repo_owner,
        p_repo_name: maintItem.repo_name,
        p_next_order: nextOrder,
      },
    )

    if (rpcError) {
      // Another tab placed this repository after the lookup
      if (isUniqueViolation(rpcError)) {
        throw toUniqueViolationError({
          error: rpcError,
          raceMessage: toDialogRaceMessage(
            maintItem.repo_owner,
            maintItem.repo_name,
          ),
          action: 'restoreToBoard',
          userId: claims.sub,
        })
      }

      log.error({ error: rpcError }, 'restore_to_board RPC error')
      Sentry.captureException(rpcError, {
        extra: { context: 'restore_to_board RPC', maintenanceId, boardId },
      })
      throw new Error('Failed to restore repository')
    }

    return { cardId }
  })
}

/**
 * Get all boards for the current user with their status lists
 *
 * Used by RestoreToBoardDialog to show available boards and columns.
 *
 * @returns
 * - On success: `{ success: true, boards: BoardWithStatusLists[] }`
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 *
 * @example
 * const result = await getUserBoardsWithStatusLists()
 * if (result.success) {
 *   result.boards.forEach(board => {
 *     console.log(board.name, board.statusLists.length, 'columns')
 *   })
 * }
 */
export async function getUserBoardsWithStatusLists(): Promise<
  ActionResult<
    Array<{
      id: string
      name: string
      statusLists: Array<{
        id: string
        name: string
        color: string
      }>
    }>
  >
> {
  return withAuthResult(async (supabase, claims) => {
    // Fetch boards
    const { data: boards, error: boardsError } = await supabase
      .from('board')
      .select('id, name')
      .eq('user_id', claims.sub)
      .order('created_at', { ascending: false })

    if (boardsError) {
      log.error({ error: boardsError }, 'Failed to fetch boards')
      throw new Error('Failed to fetch boards')
    }

    if (!boards || boards.length === 0) {
      return []
    }

    // Fetch status lists for all boards
    const boardIds = boards.map((b) => b.id)
    const { data: statusLists, error: statusError } = await supabase
      .from('statuslist')
      .select('id, name, color, board_id')
      .in('board_id', boardIds)
      .order('order', { ascending: true })

    if (statusError) {
      log.error({ error: statusError }, 'Failed to fetch status lists')
      throw new Error('Failed to fetch status lists')
    }

    // Group status lists by board
    const statusListsByBoard = new Map<
      string,
      Array<{ id: string; name: string; color: string }>
    >()
    for (const sl of statusLists || []) {
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
 * The card ID is preserved, so all projectinfo (notes, links, comments) remains intact.
 *
 * @param cardId - RepoCard ID to move
 * @param targetBoardId - Destination board ID
 * @param targetStatusId - Destination status column ID
 * @returns
 * - On success: `{ success: true }`
 * - On a malformed id: `{ success: false, error: 'Invalid ID format' }`
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - On duplicate: `{ success: false, error: 'Repository already exists in target board' }`
 * - On a lost race: `{ success: false, error: 'owner/name was just placed on a board. Close this dialog and try again.' }`
 * - On anything else (card or board not found, not the owner, column of
 *   another board): `{ success: false, error: 'An unexpected error occurred' }`
 *
 * @example
 * const result = await moveCardToBoard('card-uuid', 'board-uuid', 'status-uuid')
 * if (result.success) {
 *   dispatch(removeRepoCard('card-uuid'))
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

    // Check for duplicate in target board. Still needed on the old schema
    // while a legacy cross-board duplicate exists (Issue #215).
    const { data: existing } = await supabase
      .from('repocard')
      .select('id')
      .eq('board_id', targetBoardId)
      .eq('repo_owner', card.repo_owner)
      .eq('repo_name', card.repo_name)
      .maybeSingle()

    if (existing) {
      throw new ActionUserError('Repository already exists in target board')
    }

    // Atomic move via RPC (calculates next order position)
    const { error: rpcError } = await supabase.rpc('move_card_to_board', {
      p_card_id: cardId,
      p_target_board_id: targetBoardId,
      p_target_status_id: targetStatusId,
    })

    if (rpcError) {
      // Another tab placed this repository on a board after the check
      if (isUniqueViolation(rpcError)) {
        throw toUniqueViolationError({
          error: rpcError,
          raceMessage: toDialogRaceMessage(card.repo_owner, card.repo_name),
          action: 'moveCardToBoard',
          userId: claims.sub,
        })
      }

      log.error({ error: rpcError }, 'move_card_to_board RPC error')
      Sentry.captureException(rpcError, {
        extra: { context: 'move_card_to_board RPC', cardId, targetBoardId },
      })
      throw new Error('Failed to move card')
    }
  })
}

/**
 * Move a RepoCard to Maintenance mode
 *
 * Transfers a repository card from the active board to the maintenance archive.
 * Creates a maintenance entry with the card's metadata and removes it from the board.
 *
 * @param cardId - RepoCard ID to move to maintenance
 * @returns
 * - On success: `{ success: true, maintenanceId: string }`
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - On not found: `{ success: false, error: 'Card not found' }`
 * - On ownership error: `{ success: false, error: 'Unauthorized' }`
 * - On duplicate: `{ success: false, error: 'Repository already in maintenance' }`
 * - On insert error: `{ success: false, error: 'Failed to move to maintenance' }`
 *
 * @example
 * const result = await moveToMaintenance('card-uuid-123')
 * if (result.success) {
 *   console.log('Moved to maintenance:', result.maintenanceId)
 * } else {
 *   console.error('Failed:', result.error)
 * }
 */
export async function moveToMaintenance(
  cardId: string,
): Promise<ActionResult<{ maintenanceId: string }>> {
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

    // Check if already in maintenance
    const { data: existing } = await supabase
      .from('maintenance')
      .select('id')
      .eq('user_id', claims.sub)
      .eq('repo_owner', card.repo_owner)
      .eq('repo_name', card.repo_name)
      .maybeSingle()

    if (existing) {
      throw new Error('Repository already in maintenance')
    }

    // Atomic transaction: insert maintenance → transfer projectinfo FK → delete repocard
    const { data: maintId, error: rpcError } = await supabase.rpc(
      'move_to_maintenance',
      {
        p_card_id: cardId,
        p_user_id: claims.sub,
        p_repo_owner: card.repo_owner,
        p_repo_name: card.repo_name,
      },
    )

    if (rpcError) {
      log.error({ error: rpcError }, 'move_to_maintenance RPC error')
      Sentry.captureException(rpcError, {
        extra: { context: 'move_to_maintenance RPC', cardId },
      })
      throw new Error('Failed to move to maintenance')
    }

    return { maintenanceId: maintId }
  })
}

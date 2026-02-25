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

import type { ActionResult } from './types'

const log = createModuleLogger('repo-cards')

/**
 * Created card data returned from addRepositoriesToBoard
 * Used for optimistic UI updates in the client
 */
export interface CreatedRepoCard {
  id: string
  boardId: string
  statusId: string
  repoOwner: string
  repoName: string
  order: number
  meta: {
    stars?: number
    language?: string | null
    topics?: string[]
    visibility?: string
    description?: string | null
    updatedAt?: string
  }
  createdAt: string
  updatedAt: string
}

/**
 * Add multiple repositories to board
 *
 * @param boardId - Target board ID
 * @param statusId - Initial status (column) ID
 * @param repositories - List of GitHub repositories to add
 * @returns
 * - On success: `{ success: true, addedCount: number, cards: CreatedRepoCard[] }`
 * - On failure: `{ success: false, addedCount: 0, errors: string[] }`
 * @example
 * const result = await addRepositoriesToBoard(boardId, statusId, repos)
 * if (result.success) {
 *   dispatch(addRepoCards(result.cards)) // Optimistic update
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
    duplicateWarnings?: string[]
  }>
> {
  return withAuthResultRateLimit('addReposToBoard', async (supabase, user) => {
    // Check if board exists and user owns it
    const { data: board, error: boardError } = await supabase
      .from('board')
      .select('id, user_id')
      .eq('id', boardId)
      .eq('user_id', user.id)
      .single()

    if (boardError || !board) {
      throw new Error('Board not found')
    }

    // Get existing cards and check for duplicates
    const { data: existingCards, error: existingError } = await supabase
      .from('repocard')
      .select('repo_owner, repo_name')
      .eq('board_id', boardId)

    if (existingError) {
      throw new Error('Failed to fetch existing cards')
    }

    const existingRepoKeys = new Set(
      existingCards?.map((card) => `${card.repo_owner}/${card.repo_name}`) ||
        [],
    )

    // Also exclude repos in maintenance mode (defense-in-depth)
    const { data: maintenanceRepos } = await supabase
      .from('maintenance')
      .select('repo_owner, repo_name')
      .eq('user_id', user.id)

    for (const m of maintenanceRepos || []) {
      existingRepoKeys.add(`${m.repo_owner}/${m.repo_name}`)
    }

    // Filter to only non-duplicate repositories
    const newRepos = repositories.filter((repo) => {
      const key = `${repo.owner.login}/${repo.name}`
      return !existingRepoKeys.has(key)
    })

    if (newRepos.length === 0) {
      throw new Error('All repositories have already been added')
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
      },
    }))

    const { data: insertedCards, error: insertError } = await supabase
      .from('repocard')
      .insert(cardsToInsert)
      .select(
        'id, board_id, status_id, repo_owner, repo_name, order, meta, created_at, updated_at',
      )

    if (insertError) {
      log.error({ error: insertError }, 'RepoCard insert error')
      Sentry.captureException(insertError, {
        extra: { context: 'RepoCard insert', boardId },
      })
      throw new Error('Failed to add cards: ' + insertError.message)
    }

    // Transform database response to CreatedRepoCard format
    const createdCards: CreatedRepoCard[] = (insertedCards || []).map(
      (card) => ({
        id: card.id,
        boardId: card.board_id,
        statusId: card.status_id,
        repoOwner: card.repo_owner,
        repoName: card.repo_name,
        order: card.order,
        meta: card.meta as CreatedRepoCard['meta'],
        createdAt: card.created_at ?? new Date().toISOString(),
        updatedAt: card.updated_at ?? new Date().toISOString(),
      }),
    )

    const duplicateCount = repositories.length - newRepos.length

    return {
      addedCount: newRepos.length,
      cards: createdCards,
      duplicateWarnings:
        duplicateCount > 0
          ? [`${duplicateCount} repositories were duplicates`]
          : undefined,
    }
  })
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
 * - On success: `{ success: true, cardId: string }`
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - On not found: `{ success: false, error: 'Maintenance item not found' }`
 * - On duplicate: `{ success: false, error: 'Repository already exists in this board' }`
 * - On insert error: `{ success: false, error: 'Failed to restore repository' }`
 *
 * @example
 * const result = await restoreToBoard('maint-uuid-123', 'board-uuid-456', 'status-uuid-789')
 * if (result.success) {
 *   console.log('Restored to board, new card:', result.cardId)
 * } else {
 *   console.error('Failed:', result.error)
 * }
 */
export async function restoreToBoard(
  maintenanceId: string,
  boardId: string,
  statusId: string,
): Promise<ActionResult<{ cardId: string }>> {
  return withAuthResultRateLimit('boardCrud', async (supabase, user) => {
    // Fetch maintenance item with ownership check
    const { data: maintItem, error: maintError } = await supabase
      .from('maintenance')
      .select('*')
      .eq('id', maintenanceId)
      .eq('user_id', user.id)
      .single()

    if (maintError || !maintItem) {
      throw new Error('Maintenance item not found')
    }

    // Verify board ownership
    const { data: board, error: boardError } = await supabase
      .from('board')
      .select('id')
      .eq('id', boardId)
      .eq('user_id', user.id)
      .single()

    if (boardError || !board) {
      throw new Error('Board not found')
    }

    // Check for duplicate in target board
    const { data: existing } = await supabase
      .from('repocard')
      .select('id')
      .eq('board_id', boardId)
      .eq('repo_owner', maintItem.repo_owner)
      .eq('repo_name', maintItem.repo_name)
      .maybeSingle()

    if (existing) {
      throw new Error('Repository already exists in this board')
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
  return withAuthResult(async (supabase, user) => {
    // Fetch boards
    const { data: boards, error: boardsError } = await supabase
      .from('board')
      .select('id, name')
      .eq('user_id', user.id)
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
 * - On auth error: `{ success: false, error: 'Authentication required' }`
 * - On not found: `{ success: false, error: 'Card not found' }`
 * - On ownership error: `{ success: false, error: 'Unauthorized' }`
 * - On duplicate: `{ success: false, error: 'Repository already exists in target board' }`
 * - On invalid status: `{ success: false, error: 'Status column does not belong to target board' }`
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

  return withAuthResultRateLimit('boardCrud', async (supabase, user) => {
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
    if (!boardData || boardData.user_id !== user.id) {
      throw new Error('Unauthorized')
    }

    // Verify target board exists and user owns it
    const { data: targetBoard, error: targetBoardError } = await supabase
      .from('board')
      .select('id')
      .eq('id', targetBoardId)
      .eq('user_id', user.id)
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

    // Check for duplicate in target board
    const { data: existing } = await supabase
      .from('repocard')
      .select('id')
      .eq('board_id', targetBoardId)
      .eq('repo_owner', card.repo_owner)
      .eq('repo_name', card.repo_name)
      .maybeSingle()

    if (existing) {
      throw new Error('Repository already exists in target board')
    }

    // Atomic move via RPC (calculates next order position)
    const { error: rpcError } = await supabase.rpc('move_card_to_board', {
      p_card_id: cardId,
      p_target_board_id: targetBoardId,
      p_target_status_id: targetStatusId,
    })

    if (rpcError) {
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
  return withAuthResultRateLimit('boardCrud', async (supabase, user) => {
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
    if (!boardData || boardData.user_id !== user.id) {
      throw new Error('Unauthorized')
    }

    // Check if already in maintenance
    const { data: existing } = await supabase
      .from('maintenance')
      .select('id')
      .eq('user_id', user.id)
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
        p_user_id: user.id,
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

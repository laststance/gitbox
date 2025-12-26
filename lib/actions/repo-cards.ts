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

import { revalidatePath } from 'next/cache'

import type { GitHubRepository } from '@/lib/actions/github'
import { createClient } from '@/lib/supabase/server'

/**
 * RepoCard addition parameters
 */
export interface AddRepoCardParams {
  boardId: string
  statusId: string
  repository: {
    owner: string
    name: string
    description?: string | null
    stars?: number
    language?: string | null
    topics?: string[]
    visibility?: 'public' | 'private'
    updatedAt?: string
  }
  order?: number
}

/**
 * Add multiple repositories to board
 *
 * @param boardId - Target board ID
 * @param statusId - Initial status (column) ID
 * @param repositories - List of GitHub repositories to add
 * @returns Number of cards added
 */
export async function addRepositoriesToBoard(
  boardId: string,
  statusId: string,
  repositories: GitHubRepository[],
): Promise<{ success: boolean; addedCount: number; errors?: string[] }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Authentication required')
    }

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

    // Filter to only non-duplicate repositories
    const newRepos = repositories.filter((repo) => {
      const key = `${repo.owner.login}/${repo.name}`
      return !existingRepoKeys.has(key)
    })

    if (newRepos.length === 0) {
      return {
        success: false,
        addedCount: 0,
        errors: ['All repositories have already been added'],
      }
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
      note: '',
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

    const { error: insertError } = await supabase
      .from('repocard')
      .insert(cardsToInsert)

    if (insertError) {
      console.error('RepoCard insert error:', insertError)
      throw new Error('Failed to add cards: ' + insertError.message)
    }

    const duplicateCount = repositories.length - newRepos.length

    return {
      success: true,
      addedCount: newRepos.length,
      errors:
        duplicateCount > 0
          ? [`${duplicateCount} repositories were duplicates`]
          : undefined,
    }
  } catch (error) {
    console.error('Add repositories error:', error)
    return {
      success: false,
      addedCount: 0,
      errors: [
        error instanceof Error ? error.message : 'Unknown error occurred',
      ],
    }
  }
}

/**
 * Check if repository is already added to board
 *
 * @param boardId - Board ID
 * @param repoOwner - Repository owner
 * @param repoName - Repository name
 * @returns True if duplicate
 */
export async function checkDuplicateRepository(
  boardId: string,
  repoOwner: string,
  repoName: string,
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('repocard')
      .select('id')
      .eq('board_id', boardId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName)
      .maybeSingle()

    if (error) {
      console.error('Check duplicate error:', error)
      return false
    }

    return data !== null
  } catch (error) {
    console.error('Check duplicate error:', error)
    return false
  }
}

/**
 * Update RepoCard quick note
 *
 * @param cardId - Card ID
 * @param note - New note (max 300 characters)
 * @returns Update success flag
 */
export async function updateRepoCardNote(
  cardId: string,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (note.length > 300) {
      return {
        success: false,
        error: 'Note must be 300 characters or less',
      }
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Update card (ownership check is done automatically by RLS policy)
    const { error: updateError } = await supabase
      .from('repocard')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('id', cardId)

    if (updateError) {
      console.error('Update note error:', updateError)
      return {
        success: false,
        error: 'Failed to update note',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update note error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Delete RepoCard
 *
 * @param cardId - Card ID
 * @returns Deletion success flag
 */
export async function deleteRepoCard(
  cardId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Delete card (ownership check is done automatically by RLS policy)
    const { error: deleteError } = await supabase
      .from('repocard')
      .delete()
      .eq('id', cardId)

    if (deleteError) {
      console.error('Delete card error:', deleteError)
      return {
        success: false,
        error: 'Failed to delete card',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete card error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Update RepoCard order (sort order)
 *
 * @param cardId - Card ID
 * @param statusId - New status ID (when moving columns)
 * @param newOrder - New order value
 * @returns Update success flag
 */
export async function updateRepoCardOrder(
  cardId: string,
  statusId: string,
  newOrder: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Update card (ownership check is done automatically by RLS policy)
    const { error: updateError } = await supabase
      .from('repocard')
      .update({
        status_id: statusId,
        order: newOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)

    if (updateError) {
      console.error('Update order error:', updateError)
      return {
        success: false,
        error: 'Failed to move card',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update order error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
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
): Promise<{ success: boolean; cardId?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    // Fetch maintenance item with ownership check
    const { data: maintItem, error: maintError } = await supabase
      .from('maintenance')
      .select('*')
      .eq('id', maintenanceId)
      .eq('user_id', user.id)
      .single()

    if (maintError || !maintItem) {
      return { success: false, error: 'Maintenance item not found' }
    }

    // Verify board ownership
    const { data: board, error: boardError } = await supabase
      .from('board')
      .select('id')
      .eq('id', boardId)
      .eq('user_id', user.id)
      .single()

    if (boardError || !board) {
      return { success: false, error: 'Board not found' }
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
      return {
        success: false,
        error: 'Repository already exists in this board',
      }
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

    // Create new repocard
    const { data: newCard, error: insertError } = await supabase
      .from('repocard')
      .insert({
        board_id: boardId,
        status_id: statusId,
        repo_owner: maintItem.repo_owner,
        repo_name: maintItem.repo_name,
        note: maintItem.note || '',
        order: nextOrder,
        meta: {},
      })
      .select('id')
      .single()

    if (insertError || !newCard) {
      console.error('RepoCard insert error:', insertError)
      return { success: false, error: 'Failed to restore repository' }
    }

    // Delete from maintenance
    const { error: deleteError } = await supabase
      .from('maintenance')
      .delete()
      .eq('id', maintenanceId)

    if (deleteError) {
      // Rollback: delete the card we just created
      await supabase.from('repocard').delete().eq('id', newCard.id)
      console.error('Maintenance delete error:', deleteError)
      return { success: false, error: 'Failed to remove from maintenance' }
    }

    revalidatePath('/maintenance')
    revalidatePath(`/board/${boardId}`)

    return { success: true, cardId: newCard.id }
  } catch (error) {
    console.error('Restore to board error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
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
export async function getUserBoardsWithStatusLists(): Promise<{
  success: boolean
  boards?: Array<{
    id: string
    name: string
    statusLists: Array<{
      id: string
      name: string
      color: string
    }>
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    // Fetch boards
    const { data: boards, error: boardsError } = await supabase
      .from('board')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (boardsError) {
      console.error('Failed to fetch boards:', boardsError)
      return { success: false, error: 'Failed to fetch boards' }
    }

    if (!boards || boards.length === 0) {
      return { success: true, boards: [] }
    }

    // Fetch status lists for all boards
    const boardIds = boards.map((b) => b.id)
    const { data: statusLists, error: statusError } = await supabase
      .from('statuslist')
      .select('id, name, color, board_id')
      .in('board_id', boardIds)
      .order('order', { ascending: true })

    if (statusError) {
      console.error('Failed to fetch status lists:', statusError)
      return { success: false, error: 'Failed to fetch status lists' }
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
    const result = boards.map((board) => ({
      id: board.id,
      name: board.name,
      statusLists: statusListsByBoard.get(board.id) || [],
    }))

    return { success: true, boards: result }
  } catch (error) {
    console.error('Get user boards with status lists error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

export async function moveToMaintenance(
  cardId: string,
): Promise<{ success: boolean; maintenanceId?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    // Fetch card with board ownership check
    const { data: card, error: cardError } = await supabase
      .from('repocard')
      .select('*, board:board_id(user_id)')
      .eq('id', cardId)
      .single()

    if (cardError || !card) {
      return { success: false, error: 'Card not found' }
    }

    // Verify ownership via board's user_id
    const boardData = card.board as { user_id: string } | null
    if (!boardData || boardData.user_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
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
      return { success: false, error: 'Repository already in maintenance' }
    }

    // Create maintenance entry (without repo_card_id since we'll delete the card)
    const { data: maintEntry, error: insertError } = await supabase
      .from('maintenance')
      .insert({
        user_id: user.id,
        repo_owner: card.repo_owner,
        repo_name: card.repo_name,
        note: card.note || null,
        hidden: false,
      })
      .select('id')
      .single()

    if (insertError || !maintEntry) {
      console.error('Maintenance insert error:', insertError)
      return { success: false, error: 'Failed to move to maintenance' }
    }

    // Delete the repocard from the board
    const { error: deleteError } = await supabase
      .from('repocard')
      .delete()
      .eq('id', cardId)

    if (deleteError) {
      // Rollback: delete the maintenance entry we just created
      await supabase.from('maintenance').delete().eq('id', maintEntry.id)
      console.error('RepoCard delete error:', deleteError)
      return { success: false, error: 'Failed to remove card from board' }
    }

    // Revalidate affected paths
    revalidatePath('/maintenance')
    revalidatePath(`/board/${card.board_id}`)

    return { success: true, maintenanceId: maintEntry.id }
  } catch (error) {
    console.error('Move to maintenance error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Board Data Actions
 *
 * Server actions to fetch and update board's StatusList and RepoCard from Supabase
 * Used by KanbanBoard component
 */

'use server'

import type {
  StatusListDomain,
  RepoCardDomain,
  RepoCardMeta,
} from '@/lib/models/domain'
import { createClient } from '@/lib/supabase/server'

/**
 * Get board's StatusList
 *
 * @param boardId - Board ID
 * @returns Array of StatusList (ordered by order field)
 */
export async function getStatusLists(
  boardId: string,
): Promise<{ success: boolean; data?: StatusListDomain[]; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: statusLists, error } = await supabase
      .from('statuslist')
      .select('*')
      .eq('board_id', boardId)
      .order('order', { ascending: true })

    if (error) {
      console.error('Failed to fetch status lists:', error)
      return { success: false, error: error.message }
    }

    // Map DB type to domain type
    const mapped: StatusListDomain[] = (statusLists || []).map((sl) => ({
      id: sl.id,
      title: sl.name,
      wipLimit: sl.wip_limit ?? 0,
      color: sl.color ?? '#6B7280',
      order: sl.order,
      boardId: sl.board_id,
      createdAt: sl.created_at ?? new Date().toISOString(),
      updatedAt: sl.updated_at ?? new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Get status lists error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get board's RepoCard
 *
 * @param boardId - Board ID
 * @returns Array of RepoCard (ordered by order field)
 */
export async function getRepoCards(
  boardId: string,
): Promise<{ success: boolean; data?: RepoCardDomain[]; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: repoCards, error } = await supabase
      .from('repocard')
      .select('*')
      .eq('board_id', boardId)
      .order('order', { ascending: true })

    if (error) {
      console.error('Failed to fetch repo cards:', error)
      return { success: false, error: error.message }
    }

    // Map DB type to domain type
    const mapped: RepoCardDomain[] = (repoCards || []).map((rc) => ({
      id: rc.id,
      title: rc.repo_name,
      description:
        (rc.meta as RepoCardMeta)?.description ?? rc.note ?? undefined,
      statusId: rc.status_id,
      boardId: rc.board_id,
      repoOwner: rc.repo_owner,
      repoName: rc.repo_name,
      note: rc.note,
      order: rc.order,
      meta: (rc.meta as RepoCardMeta) ?? {},
      createdAt: rc.created_at ?? new Date().toISOString(),
      updatedAt: rc.updated_at ?? new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Get repo cards error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get board's StatusList and RepoCard in batch
 *
 * @param boardId - Board ID
 * @returns Arrays of StatusList and RepoCard
 */
export async function getBoardData(boardId: string): Promise<{
  success: boolean
  statusLists?: StatusListDomain[]
  repoCards?: RepoCardDomain[]
  error?: string
}> {
  try {
    const [statusResult, cardsResult] = await Promise.all([
      getStatusLists(boardId),
      getRepoCards(boardId),
    ])

    if (!statusResult.success) {
      return { success: false, error: statusResult.error }
    }

    if (!cardsResult.success) {
      return { success: false, error: cardsResult.error }
    }

    return {
      success: true,
      statusLists: statusResult.data,
      repoCards: cardsResult.data,
    }
  } catch (error) {
    console.error('Get board data error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create default StatusList
 * Called when creating a new board
 *
 * @param boardId - Board ID
 * @returns Array of created StatusList
 */
export async function createDefaultStatusLists(
  boardId: string,
): Promise<{ success: boolean; data?: StatusListDomain[]; error?: string }> {
  try {
    const supabase = await createClient()

    const defaultStatuses = [
      { name: 'Suspend', color: '#8B7355', order: 0 },
      { name: 'Spec designing', color: '#6B8E23', order: 1 },
      { name: 'Active', color: '#CD853F', order: 2 },
      { name: 'Completed', color: '#556B2F', order: 3 },
    ]

    const { data, error } = await supabase
      .from('statuslist')
      .insert(
        defaultStatuses.map((status) => ({
          board_id: boardId,
          ...status,
        })),
      )
      .select()

    if (error) {
      console.error('Failed to create default status lists:', error)
      return { success: false, error: error.message }
    }

    // Map DB type to domain type
    const mapped: StatusListDomain[] = (data || []).map((sl) => ({
      id: sl.id,
      title: sl.name,
      wipLimit: sl.wip_limit ?? 0,
      color: sl.color ?? '#6B7280',
      order: sl.order,
      boardId: sl.board_id,
      createdAt: sl.created_at ?? new Date().toISOString(),
      updatedAt: sl.updated_at ?? new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Create default status lists error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update RepoCard status and order (after drag & drop)
 *
 * @param cardId - Card ID
 * @param statusId - New status ID
 * @param order - New order
 * @returns Update result
 */
export async function updateCardPosition(
  cardId: string,
  statusId: string,
  order: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('repocard')
      .update({
        status_id: statusId,
        order: order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)

    if (error) {
      console.error('Failed to update card position:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Update card position error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Batch update card order (reordering after drag & drop)
 *
 * @param updates - Array of card ID and new order pairs
 * @returns Update result
 */
export async function updateCardsOrder(
  updates: { id: string; statusId: string; order: number }[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Update each card sequentially (as a transaction alternative)
    for (const update of updates) {
      const { error } = await supabase
        .from('repocard')
        .update({
          status_id: update.statusId,
          order: update.order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id)

      if (error) {
        console.error('Failed to update card order:', error)
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update cards order error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create new board
 *
 * @param userId - User ID
 * @param name - Board name
 * @param theme - Theme
 * @returns Created board ID
 */
export async function createBoard(
  userId: string,
  name: string,
  theme: string = 'sunrise',
): Promise<{ success: boolean; boardId?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // Create board
    const { data: board, error: boardError } = await supabase
      .from('board')
      .insert({
        user_id: userId,
        name: name,
        theme: theme,
        settings: {},
      })
      .select('id')
      .single()

    if (boardError) {
      console.error('Failed to create board:', boardError)
      return { success: false, error: boardError.message }
    }

    // Create default StatusList
    const defaultResult = await createDefaultStatusLists(board.id)
    if (!defaultResult.success) {
      console.error(
        'Failed to create default status lists:',
        defaultResult.error,
      )
      // Board is created, so treat as success despite error display
    }

    return { success: true, boardId: board.id }
  } catch (error) {
    console.error('Create board error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete board
 *
 * @param boardId - Board ID
 * @returns Deletion result
 */
export async function deleteBoard(
  boardId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('board').delete().eq('id', boardId)

    if (error) {
      console.error('Failed to delete board:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete board error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

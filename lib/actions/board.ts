/**
 * Board Actions
 *
 * Server Actions for Board, StatusList, and RepoCard operations.
 * Provides Supabase integration for Kanban board functionality.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Tables, TablesInsert } from '@/lib/supabase/types'
import type { StatusListDomain, RepoCardDomain, RepoCardMeta } from '@/lib/models/domain'
import { logBoardCreate } from './audit-log'

type StatusListRow = Tables<'statuslist'>
type RepoCardRow = Tables<'repocard'>

// ========================================
// StatusList Operations
// ========================================

/**
 * Get all status lists for a board
 */
export async function getStatusLists(boardId: string): Promise<StatusListDomain[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('statuslist')
    .select('*')
    .eq('board_id', boardId)
    .order('order', { ascending: true })

  if (error) {
    console.error('Failed to fetch status lists:', error)
    throw new Error('Failed to fetch status lists')
  }

  // Convert DB rows to domain model
  return (data || []).map((row: StatusListRow) => ({
    id: row.id,
    title: row.name,
    wipLimit: row.wip_limit ?? 0,
    color: row.color ?? '#6B7280',
    order: row.order,
    boardId: row.board_id,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }))
}

/**
 * Create default status lists for a new board
 * Called when a board has no status lists
 */
export async function createDefaultStatusLists(boardId: string): Promise<StatusListDomain[]> {
  const supabase = await createClient()

  const defaultLists: TablesInsert<'statuslist'>[] = [
    { board_id: boardId, name: 'Backlog', color: '#8B7355', order: 0, wip_limit: null },
    { board_id: boardId, name: 'Todo', color: '#6B8E23', order: 1, wip_limit: 5 },
    { board_id: boardId, name: 'In Progress', color: '#CD853F', order: 2, wip_limit: 3 },
    { board_id: boardId, name: 'Review', color: '#4682B4', order: 3, wip_limit: 4 },
    { board_id: boardId, name: 'Done', color: '#556B2F', order: 4, wip_limit: null },
  ]

  const { data, error } = await supabase
    .from('statuslist')
    .insert(defaultLists)
    .select()

  if (error) {
    console.error('Failed to create default status lists:', error)
    throw new Error('Failed to create default status lists')
  }

  revalidatePath(`/board/${boardId}`)

  return (data || []).map((row: StatusListRow) => ({
    id: row.id,
    title: row.name,
    wipLimit: row.wip_limit ?? 0,
    color: row.color ?? '#6B7280',
    order: row.order,
    boardId: row.board_id,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }))
}

/**
 * Create a new status list
 */
export async function createStatusList(
  boardId: string,
  name: string,
  color: string = '#6B7280',
  wipLimit?: number
): Promise<StatusListDomain> {
  const supabase = await createClient()

  // Get the current max order
  const { data: maxOrderData } = await supabase
    .from('statuslist')
    .select('order')
    .eq('board_id', boardId)
    .order('order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxOrderData?.order ?? -1) + 1

  const { data, error } = await supabase
    .from('statuslist')
    .insert({
      board_id: boardId,
      name,
      color,
      order: nextOrder,
      wip_limit: wipLimit ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Failed to create status list:', error)
    throw new Error('Failed to create status list')
  }

  revalidatePath(`/board/${boardId}`)

  return {
    id: data.id,
    title: data.name,
    wipLimit: data.wip_limit ?? 0,
    color: data.color ?? '#6B7280',
    order: data.order,
    boardId: data.board_id,
    createdAt: data.created_at ?? new Date().toISOString(),
    updatedAt: data.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Update a status list
 */
export async function updateStatusList(
  statusId: string,
  updates: { name?: string; color?: string; wipLimit?: number | null }
): Promise<void> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.color !== undefined) updateData.color = updates.color
  if (updates.wipLimit !== undefined) updateData.wip_limit = updates.wipLimit

  const { error } = await supabase
    .from('statuslist')
    .update(updateData)
    .eq('id', statusId)

  if (error) {
    console.error('Failed to update status list:', error)
    throw new Error('Failed to update status list')
  }
}

/**
 * Delete a status list
 */
export async function deleteStatusList(statusId: string, boardId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('statuslist')
    .delete()
    .eq('id', statusId)

  if (error) {
    console.error('Failed to delete status list:', error)
    throw new Error('Failed to delete status list')
  }

  revalidatePath(`/board/${boardId}`)
}

// ========================================
// RepoCard Operations
// ========================================

/**
 * Get all repo cards for a board
 */
export async function getRepoCards(boardId: string): Promise<RepoCardDomain[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('repocard')
    .select('*')
    .eq('board_id', boardId)
    .order('order', { ascending: true })

  if (error) {
    console.error('Failed to fetch repo cards:', error)
    throw new Error('Failed to fetch repo cards')
  }

  // Convert DB rows to domain model
  return (data || []).map((row: RepoCardRow) => {
    const meta = (row.meta as RepoCardMeta) || {}
    return {
      id: row.id,
      title: `${row.repo_owner}/${row.repo_name}`,
      description: row.note || meta.topics?.join(', ') || '',
      statusId: row.status_id,
      boardId: row.board_id,
      repoOwner: row.repo_owner,
      repoName: row.repo_name,
      note: row.note,
      order: row.order,
      meta: {
        stars: meta.stars,
        updatedAt: meta.updatedAt,
        visibility: meta.visibility,
        language: meta.language,
        topics: meta.topics,
      },
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? new Date().toISOString(),
    }
  })
}

/**
 * Update repo card position (status and/or order)
 * Used for drag & drop operations
 */
export async function updateRepoCardPosition(
  cardId: string,
  statusId: string,
  order: number
): Promise<void> {
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
    console.error('Failed to update repo card position:', error)
    throw new Error('Failed to update repo card position')
  }
}

/**
 * Batch update repo card orders
 * Used when reordering multiple cards within a column
 */
export async function batchUpdateRepoCardOrders(
  updates: Array<{ id: string; statusId: string; order: number }>
): Promise<void> {
  const supabase = await createClient()

  // Use a transaction-like approach with Promise.all
  const updatePromises = updates.map(({ id, statusId, order }) =>
    supabase
      .from('repocard')
      .update({
        status_id: statusId,
        order: order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  )

  const results = await Promise.all(updatePromises)

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    console.error('Failed to batch update repo card orders:', errors)
    throw new Error('Failed to update some repo cards')
  }
}

// ========================================
// Board Operations
// ========================================

/**
 * Get board data with status lists and repo cards
 */
export async function getBoardData(boardId: string): Promise<{
  statusLists: StatusListDomain[]
  repoCards: RepoCardDomain[]
}> {
  // Fetch in parallel for better performance
  const [statusLists, repoCards] = await Promise.all([
    getStatusLists(boardId),
    getRepoCards(boardId),
  ])

  // If no status lists exist, create defaults
  if (statusLists.length === 0) {
    const defaultLists = await createDefaultStatusLists(boardId)
    return {
      statusLists: defaultLists,
      repoCards: [],
    }
  }

  return { statusLists, repoCards }
}

/**
 * Create a new board
 */
export async function createBoard(
  name: string,
  theme: string = 'sunrise'
): Promise<{ id: string; name: string }> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Authentication required')
  }

  const { data, error } = await supabase
    .from('board')
    .insert({
      user_id: user.id,
      name,
      theme,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    console.error('Failed to create board:', error)
    throw new Error('Failed to create board')
  }

  // Create default status lists for the new board
  await createDefaultStatusLists(data.id)

  // Log audit event
  await logBoardCreate(data.id)

  revalidatePath('/boards')

  return { id: data.id, name: data.name }
}

/**
 * Delete a board
 */
export async function deleteBoard(boardId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('board').delete().eq('id', boardId)

  if (error) {
    console.error('Failed to delete board:', error)
    throw new Error('Failed to delete board')
  }

  revalidatePath('/boards')
}

/**
 * Update board settings
 */
export async function updateBoard(
  boardId: string,
  updates: { name?: string; theme?: string }
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('board').update(updates).eq('id', boardId)

  if (error) {
    console.error('Failed to update board:', error)
    throw new Error('Failed to update board')
  }

  revalidatePath(`/board/${boardId}`)
  revalidatePath('/boards')
}


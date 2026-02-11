/**
 * Board Actions
 *
 * Server Actions for Board, StatusList, and RepoCard operations.
 * Provides Supabase integration for Kanban board functionality.
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import type {
  StatusListDomain,
  RepoCardDomain,
  RepoCardMeta,
} from '@/lib/models/domain'
import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert } from '@/lib/supabase/types'
import {
  boardNameSchema,
  boardIdSchema,
  boardSettingsSchema,
  boardPositionUpdatesSchema,
  statusListNameSchema,
  statusListColorSchema,
  gridPositionSchema,
} from '@/lib/validations/board'

type StatusListRow = Tables<'statuslist'>
type RepoCardRow = Tables<'repocard'>

// ========================================
// StatusList Operations
// ========================================

/**
 * Get all status lists for a board
 * Ordered by grid position (row first, then column)
 */
export async function getStatusLists(
  boardId: string,
): Promise<StatusListDomain[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('statuslist')
    .select('*')
    .eq('board_id', boardId)
    .order('grid_row', { ascending: true })
    .order('grid_col', { ascending: true })

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Fetch status lists', boardId },
    })
    throw new Error('Failed to fetch status lists')
  }

  // Convert DB rows to domain model
  return (data || []).map((row: StatusListRow) => ({
    id: row.id,
    title: row.name,
    color: row.color ?? '#6B7280',
    gridRow: row.grid_row ?? 0,
    gridCol: row.grid_col ?? 0,
    boardId: row.board_id,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }))
}

/**
 * Create default status lists for a new board
 * Called when a board has no status lists
 * All columns start in row 0 (single row layout)
 */
export async function createDefaultStatusLists(
  boardId: string,
): Promise<StatusListDomain[]> {
  const supabase = await createClient()

  const defaultLists: TablesInsert<'statuslist'>[] = [
    {
      board_id: boardId,
      name: 'Pending',
      color: '#8B7355',
      order: 0,
      grid_row: 0,
      grid_col: 0,
    },
    {
      board_id: boardId,
      name: 'Planning',
      color: '#6B8E23',
      order: 1,
      grid_row: 0,
      grid_col: 1,
    },
    {
      board_id: boardId,
      name: 'Focus Development',
      color: '#CD853F',
      order: 2,
      grid_row: 0,
      grid_col: 2,
    },
    {
      board_id: boardId,
      name: 'MVP Release',
      color: '#4682B4',
      order: 3,
      grid_row: 0,
      grid_col: 3,
    },
    {
      board_id: boardId,
      name: 'Production Release',
      color: '#556B2F',
      order: 4,
      grid_row: 0,
      grid_col: 4,
    },
  ]

  const { data, error } = await supabase
    .from('statuslist')
    .insert(defaultLists)
    .select()

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Create default status lists', boardId },
    })
    throw new Error('Failed to create default status lists')
  }

  return (data || []).map((row: StatusListRow) => ({
    id: row.id,
    title: row.name,
    color: row.color ?? '#6B7280',
    gridRow: row.grid_row ?? 0,
    gridCol: row.grid_col ?? 0,
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
): Promise<StatusListDomain> {
  // Validate inputs (P2-1)
  statusListNameSchema.parse(name)
  statusListColorSchema.parse(color)

  const supabase = await createClient()

  // Auth check (P1-5): RLS handles ownership, but verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication required')

  // Get the current max grid_col in row 0
  const { data: maxColData } = await supabase
    .from('statuslist')
    .select('grid_col')
    .eq('board_id', boardId)
    .eq('grid_row', 0)
    .order('grid_col', { ascending: false })
    .limit(1)
    .single()

  const nextCol = (maxColData?.grid_col ?? -1) + 1

  const { data, error } = await supabase
    .from('statuslist')
    .insert({
      board_id: boardId,
      name,
      color,
      order: nextCol, // Keep order in sync for backwards compatibility
      grid_row: 0,
      grid_col: nextCol,
    })
    .select()
    .single()

  if (error || !data) {
    Sentry.captureException(error ?? new Error('No data returned'), {
      extra: { context: 'Create status list', boardId, name },
    })
    throw new Error('Failed to create status list')
  }

  return {
    id: data.id,
    title: data.name,
    color: data.color ?? '#6B7280',
    gridRow: data.grid_row ?? 0,
    gridCol: data.grid_col ?? 0,
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
  updates: { name?: string; color?: string },
): Promise<void> {
  // Validate inputs (P2-1)
  if (updates.name !== undefined) statusListNameSchema.parse(updates.name)
  if (updates.color !== undefined) statusListColorSchema.parse(updates.color)

  const supabase = await createClient()

  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.color !== undefined) updateData.color = updates.color

  const { error } = await supabase
    .from('statuslist')
    .update(updateData)
    .eq('id', statusId)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Update status list', statusId, updates },
    })
    throw new Error('Failed to update status list')
  }
}

/**
 * Delete a status list
 */
export async function deleteStatusList(
  statusId: string,
  boardId: string,
): Promise<void> {
  const supabase = await createClient()

  // Auth check (P1-5)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Authentication required')

  const { error } = await supabase
    .from('statuslist')
    .delete()
    .eq('id', statusId)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Delete status list', statusId, boardId },
    })
    throw new Error('Failed to delete status list')
  }
}

/**
 * Update a single status list position
 * Used for moving a column to a new grid cell
 *
 * @param id - Status list ID
 * @param gridRow - New row position (0-indexed)
 * @param gridCol - New column position (0-indexed)
 */
export async function updateStatusListPosition(
  id: string,
  gridRow: number,
  gridCol: number,
): Promise<void> {
  // Validate grid position (P2-4)
  gridPositionSchema.parse({ gridRow, gridCol })

  const supabase = await createClient()

  const { error } = await supabase
    .from('statuslist')
    .update({
      grid_row: gridRow,
      grid_col: gridCol,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Update status list position', id, gridRow, gridCol },
    })
    throw new Error('Failed to update column position')
  }
}

/**
 * Swap positions between two status lists (atomic)
 * Uses a PostgreSQL RPC function for transactional safety.
 * If either update fails, both are rolled back.
 *
 * @param id1 - First status list ID
 * @param id2 - Second status list ID
 *
 * @example
 * await swapStatusListPositions('uuid-a', 'uuid-b')
 * // Atomically swaps grid_row/grid_col between the two status lists
 */
export async function swapStatusListPositions(
  id1: string,
  id2: string,
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('swap_statuslist_positions', {
    id_a: id1,
    id_b: id2,
  })

  if (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'Swap status list positions (RPC)',
        id1,
        id2,
      },
    })
    throw new Error('Failed to swap column positions')
  }
}

/**
 * Batch update status list positions
 * Used for complex drag & drop operations affecting multiple columns
 *
 * @param updates - Array of status list updates with id and new grid positions
 * @example
 * batchUpdateStatusListPositions([
 *   { id: 'status-1', gridRow: 0, gridCol: 0 },
 *   { id: 'status-2', gridRow: 1, gridCol: 0 },
 * ])
 */
export async function batchUpdateStatusListPositions(
  updates: Array<{ id: string; gridRow: number; gridCol: number }>,
): Promise<void> {
  const supabase = await createClient()

  // Atomic batch update via PostgreSQL RPC — all updates succeed or all fail
  const { error } = await supabase.rpc('batch_update_statuslist_positions', {
    p_updates: updates.map(({ id, gridRow, gridCol }) => ({
      id,
      grid_row: gridRow,
      grid_col: gridCol,
    })),
  })

  if (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'Batch update status list positions (RPC)',
        updateCount: updates.length,
      },
    })
    throw new Error('Failed to update column positions')
  }
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
    Sentry.captureException(error, {
      extra: { context: 'Fetch repo cards', boardId },
    })
    throw new Error('Failed to fetch repo cards')
  }

  // Convert DB rows to domain model
  return (data || []).map((row: RepoCardRow) => {
    const meta = (row.meta as RepoCardMeta) || {}
    return {
      id: row.id,
      title: `${row.repo_owner}/${row.repo_name}`,
      description: meta.description || '',
      statusId: row.status_id,
      boardId: row.board_id,
      repoOwner: row.repo_owner,
      repoName: row.repo_name,
      order: row.order,
      meta: {
        stars: meta.stars,
        updatedAt: meta.updatedAt,
        visibility: meta.visibility,
        language: meta.language,
        topics: meta.topics,
        description: meta.description,
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
  order: number,
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
    Sentry.captureException(error, {
      extra: { context: 'Update repo card position', cardId, statusId, order },
    })
    throw new Error('Failed to update repo card position')
  }
}

/**
 * Batch update repo card orders
 * Used when reordering multiple cards within a column
 */
export async function batchUpdateRepoCardOrders(
  updates: Array<{ id: string; statusId: string; order: number }>,
): Promise<void> {
  const supabase = await createClient()

  // Atomic batch update via PostgreSQL RPC — all updates succeed or all fail
  const { error } = await supabase.rpc('batch_update_repocard_orders', {
    p_updates: updates.map(({ id, statusId, order }) => ({
      id,
      status_id: statusId,
      order,
    })),
  })

  if (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'Batch update repo card orders (RPC)',
        updateCount: updates.length,
      },
    })
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
): Promise<{ id: string; name: string }> {
  // Validate board name (P2-3)
  boardNameSchema.parse(name)

  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Authentication required')
  }

  // Auto-assign position: append to end of user's board list
  const { data: maxPositionRow } = await supabase
    .from('board')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxPositionRow?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('board')
    .insert({
      user_id: user.id,
      name,
      position: nextPosition,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    Sentry.captureException(error ?? new Error('No data returned'), {
      extra: { context: 'Create board', name },
    })
    throw new Error('Failed to create board')
  }

  // Create default status lists for the new board
  await createDefaultStatusLists(data.id)

  return { id: data.id, name: data.name }
}

/**
 * Batch update board positions for DnD reordering.
 * Updates multiple boards' position values in parallel.
 *
 * @param updates - Array of { id, position } pairs
 * @returns void on success, throws on validation or DB error
 *
 * @example
 * // Swap two boards
 * await updateBoardPositions([
 *   { id: 'board-uuid-1', position: 1 },
 *   { id: 'board-uuid-2', position: 0 },
 * ])
 */
export async function updateBoardPositions(
  updates: Array<{ id: string; position: number }>,
): Promise<void> {
  boardPositionUpdatesSchema.parse(updates)

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Authentication required')
  }

  // Atomic batch update via PostgreSQL RPC — all updates succeed or all fail
  // Note: RLS policies on board table still enforce user ownership
  const { error } = await supabase.rpc('batch_update_board_positions', {
    p_updates: updates.map(({ id, position }) => ({ id, position })),
  })

  if (error) {
    Sentry.captureException(error, {
      extra: {
        context: 'Batch update board positions (RPC)',
        updateCount: updates.length,
      },
    })
    throw new Error('Failed to update board positions')
  }
}

/**
 * Delete a board
 */
export async function deleteBoard(boardId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('board').delete().eq('id', boardId)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Delete board', boardId },
    })
    throw new Error('Failed to delete board')
  }
}

/**
 * Update board settings
 */
export async function updateBoard(
  boardId: string,
  updates: { name?: string },
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('board')
    .update(updates)
    .eq('id', boardId)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Update board', boardId, updates },
    })
    throw new Error('Failed to update board')
  }
}

// ========================================
// Board Rename/Delete Actions (useActionState compatible)
// ========================================

/**
 * State returned from the rename board action.
 */
export type RenameBoardState = {
  success?: boolean
  newName?: string
  errors?: { name?: string[] }
}

/**
 * State returned from the delete board action.
 */
export type DeleteBoardState = {
  success?: boolean
  error?: string
}

/**
 * Server Action for renaming a board.
 * Compatible with useActionState (accepts prevState as first arg).
 *
 * @param prevState - Previous state from useActionState
 * @param formData - Form data containing boardId and name fields
 * @returns
 * - On success: { success: true, newName: string }
 * - On validation error: { errors: { name: string[] } }
 * - On server error: { errors: { name: ['Failed to rename board'] } }
 *
 * @example
 * // In React component with useActionState
 * const [state, formAction, isPending] = useActionState(renameBoardAction, {})
 * <form action={formAction}>
 *   <input type="hidden" name="boardId" value={boardId} />
 *   <input name="name" defaultValue={currentName} />
 *   <button disabled={isPending}>Rename</button>
 * </form>
 */
export async function renameBoardAction(
  prevState: RenameBoardState,
  formData: FormData,
): Promise<RenameBoardState> {
  const boardId = formData.get('boardId') as string
  const name = formData.get('name') as string

  const result = boardNameSchema.safeParse(name)
  if (!result.success) {
    return { errors: { name: result.error.issues.map((i) => i.message) } }
  }

  try {
    await updateBoard(boardId, { name: result.data })
    return { success: true, newName: result.data }
  } catch {
    return { errors: { name: ['Failed to rename board'] } }
  }
}

/**
 * Server Action for deleting a board.
 * Compatible with useActionState (accepts prevState as first arg).
 *
 * @param prevState - Previous state from useActionState
 * @param formData - Form data containing boardId field
 * @returns
 * - On success: { success: true }
 * - On error: { error: 'Failed to delete board' }
 *
 * @example
 * // In React component with useActionState
 * const [state, formAction, isPending] = useActionState(deleteBoardAction, {})
 * <form action={formAction}>
 *   <input type="hidden" name="boardId" value={boardId} />
 *   <button disabled={isPending}>Delete</button>
 * </form>
 */
export async function deleteBoardAction(
  prevState: DeleteBoardState,
  formData: FormData,
): Promise<DeleteBoardState> {
  const boardId = formData.get('boardId') as string

  // Validate board ID format
  const idResult = boardIdSchema.safeParse(boardId)
  if (!idResult.success) {
    return { error: 'Invalid board ID' }
  }

  try {
    await deleteBoard(idResult.data)
    return { success: true }
  } catch {
    return { error: 'Failed to delete board' }
  }
}

// ========================================
// Board Favorite Operations
// ========================================

/**
 * State returned from the toggle favorite action.
 */
export type ToggleFavoriteState = {
  success?: boolean
  isFavorite?: boolean
  error?: string
}

/**
 * Toggle board favorite status.
 *
 * @param boardId - Board ID to toggle
 * @returns
 * - On success: { success: true, isFavorite: boolean }
 * - On auth error: { success: false, error: 'Authentication required' }
 * - On not found: { success: false, error: 'Board not found' }
 * - On update error: { success: false, error: 'Failed to update favorite' }
 *
 * @example
 * const result = await toggleBoardFavorite('board-123')
 * if (result.success) {
 *   console.log('New favorite status:', result.isFavorite)
 * }
 */
export async function toggleBoardFavorite(
  boardId: string,
): Promise<ToggleFavoriteState> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Authentication required' }
  }

  // Get current status
  const { data: board, error: fetchError } = await supabase
    .from('board')
    .select('is_favorite')
    .eq('id', boardId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !board) {
    return { success: false, error: 'Board not found' }
  }

  // Toggle
  const newStatus = !board.is_favorite
  const { error: updateError } = await supabase
    .from('board')
    .update({ is_favorite: newStatus, updated_at: new Date().toISOString() })
    .eq('id', boardId)

  if (updateError) {
    return { success: false, error: 'Failed to update favorite' }
  }

  return { success: true, isFavorite: newStatus }
}

// ========================================
// First Board Auto-Creation
// ========================================

/**
 * Create a "First Board" for new users if they have no existing boards.
 *
 * This function is idempotent - it only creates a board if the user
 * has zero boards. Safe to call on every login.
 *
 * @param userId - The authenticated user's ID
 * @returns
 * - Created board object if this was the user's first login
 * - null if user already has boards (no action taken)
 *
 * @example
 * // In OAuth callback after session exchange
 * const newBoard = await createFirstBoardIfNeeded(session.user.id)
 * if (newBoard) {
 *   console.log('Created first board for new user:', newBoard.id)
 * }
 */
export async function createFirstBoardIfNeeded(
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient()

  // Check if user already has any boards
  const { count, error: countError } = await supabase
    .from('board')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) {
    Sentry.captureException(countError, {
      extra: { context: 'Check existing boards', userId },
    })
    // Don't block login on error - just skip first board creation
    return null
  }

  // User already has boards - no action needed
  if (count && count > 0) {
    return null
  }

  // Create "First Board" for new user
  const { data, error } = await supabase
    .from('board')
    .insert({
      user_id: userId,
      name: 'First Board',
      position: 0,
    })
    .select('id, name')
    .single()

  if (error || !data) {
    Sentry.captureException(error ?? new Error('No data returned'), {
      extra: { context: 'Create first board', userId },
    })
    // Don't block login on error
    return null
  }

  // Create default status lists for the new board
  try {
    await createDefaultStatusLists(data.id)
  } catch (statusError) {
    Sentry.captureException(statusError, {
      extra: {
        context: 'Create default status lists for first board',
        boardId: data.id,
      },
    })
    // Board exists but without status lists - they'll be created on first access
  }

  return { id: data.id, name: data.name }
}

// ============================================================================
// Update Board Settings Action (Phase 5: Card Display Settings)
// ============================================================================

/**
 * State for updateBoardSettings action
 */
export interface UpdateBoardSettingsState {
  /** Error message if action failed */
  error?: string
  /** Success flag */
  success?: boolean
}

/**
 * Update board settings (card display preferences)
 *
 * Merges new settings with existing board.settings JSON column.
 * Supports partial updates - only provided fields are updated.
 *
 * @param _prevState - Previous action state (unused, required by useActionState)
 * @param formData - Form data containing boardId and settings JSON
 * @returns
 * - On success: { success: true }
 * - On error: { error: string }
 *
 * @example
 * // In component with useActionState
 * const [state, formAction] = useActionState(updateBoardSettingsAction, {})
 *
 * <form action={formAction}>
 *   <input type="hidden" name="boardId" value={boardId} />
 *   <input type="hidden" name="settings" value={JSON.stringify(settings)} />
 *   <button type="submit">Save</button>
 * </form>
 */
export async function updateBoardSettingsAction(
  _prevState: UpdateBoardSettingsState,
  formData: FormData,
): Promise<UpdateBoardSettingsState> {
  const boardId = formData.get('boardId') as string
  const settingsJson = formData.get('settings') as string

  // Validate board ID format
  const idResult = boardIdSchema.safeParse(boardId)
  if (!idResult.success) {
    return { error: 'Invalid board ID' }
  }

  if (!settingsJson) {
    return { error: 'Settings data is required' }
  }

  // Parse and validate settings using Zod schema
  let newSettings: Record<string, unknown>
  try {
    const parsed = JSON.parse(settingsJson)
    const settingsResult = boardSettingsSchema.safeParse(parsed)
    if (!settingsResult.success) {
      return {
        error: settingsResult.error.issues.map((i) => i.message).join(', '),
      }
    }
    newSettings = settingsResult.data as Record<string, unknown>
  } catch {
    return { error: 'Invalid settings format' }
  }

  const supabase = await createClient()

  // Get current settings
  const { data: currentBoard, error: fetchError } = await supabase
    .from('board')
    .select('settings')
    .eq('id', idResult.data)
    .single()

  if (fetchError) {
    Sentry.captureException(fetchError, {
      extra: { context: 'Fetch board settings', boardId: idResult.data },
    })
    return { error: 'Failed to fetch board settings' }
  }

  // Merge existing settings with new settings (deep merge for cardDisplay)
  type JsonValue =
    | string
    | number
    | boolean
    | null
    | { [key: string]: JsonValue }
    | JsonValue[]
  const existingSettings =
    (currentBoard?.settings as Record<string, JsonValue>) || {}
  const existingCardDisplay = (existingSettings.cardDisplay ?? {}) as Record<
    string,
    JsonValue
  >
  const newCardDisplay = (newSettings.cardDisplay ?? {}) as Record<
    string,
    JsonValue
  >
  const existingCommentText = (existingCardDisplay.commentText ?? {}) as Record<
    string,
    JsonValue
  >
  const newCommentText = (newCardDisplay.commentText ?? {}) as Record<
    string,
    JsonValue
  >

  const mergedSettings: Record<string, JsonValue> = {
    ...existingSettings,
    cardDisplay: {
      ...existingCardDisplay,
      ...newCardDisplay,
      // Deep merge commentText if present
      commentText: {
        ...existingCommentText,
        ...newCommentText,
      },
    },
  }

  // Update settings
  const { error: updateError } = await supabase
    .from('board')
    .update({ settings: mergedSettings as unknown as Record<string, never> })
    .eq('id', idResult.data)

  if (updateError) {
    Sentry.captureException(updateError, {
      extra: { context: 'Update board settings', boardId: idResult.data },
    })
    return { error: 'Failed to update board settings' }
  }

  return { success: true }
}

/**
 * Board Actions
 *
 * Server Actions for Board, StatusList, and RepoCard operations.
 * Provides Supabase integration for Kanban board functionality.
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'

import type {
  StatusListDomain,
  RepoCardDomain,
  RepoCardMeta,
} from '@/lib/models/domain'
import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert } from '@/lib/supabase/types'
import { boardNameSchema } from '@/lib/validations/board'

import { logBoardCreate } from './audit-log'

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
    wipLimit: row.wip_limit ?? 0,
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
      name: 'Backlog',
      color: '#8B7355',
      order: 0,
      grid_row: 0,
      grid_col: 0,
      wip_limit: null,
    },
    {
      board_id: boardId,
      name: 'Todo',
      color: '#6B8E23',
      order: 1,
      grid_row: 0,
      grid_col: 1,
      wip_limit: 5,
    },
    {
      board_id: boardId,
      name: 'In Progress',
      color: '#CD853F',
      order: 2,
      grid_row: 0,
      grid_col: 2,
      wip_limit: 3,
    },
    {
      board_id: boardId,
      name: 'Review',
      color: '#4682B4',
      order: 3,
      grid_row: 0,
      grid_col: 3,
      wip_limit: 4,
    },
    {
      board_id: boardId,
      name: 'Done',
      color: '#556B2F',
      order: 4,
      grid_row: 0,
      grid_col: 4,
      wip_limit: null,
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

  revalidatePath(`/board/${boardId}`)

  return (data || []).map((row: StatusListRow) => ({
    id: row.id,
    title: row.name,
    wipLimit: row.wip_limit ?? 0,
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
  wipLimit?: number,
): Promise<StatusListDomain> {
  const supabase = await createClient()

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
      wip_limit: wipLimit ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    Sentry.captureException(error ?? new Error('No data returned'), {
      extra: { context: 'Create status list', boardId, name },
    })
    throw new Error('Failed to create status list')
  }

  revalidatePath(`/board/${boardId}`)

  return {
    id: data.id,
    title: data.name,
    wipLimit: data.wip_limit ?? 0,
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
  updates: { name?: string; color?: string; wipLimit?: number | null },
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

  revalidatePath(`/board/${boardId}`)
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
 * Swap positions between two status lists
 * Used when dropping a column onto an occupied cell
 *
 * @param id1 - First status list ID
 * @param id2 - Second status list ID
 */
export async function swapStatusListPositions(
  id1: string,
  id2: string,
): Promise<void> {
  const supabase = await createClient()

  // Get current positions
  const { data: status1 } = await supabase
    .from('statuslist')
    .select('grid_row, grid_col')
    .eq('id', id1)
    .single()

  const { data: status2 } = await supabase
    .from('statuslist')
    .select('grid_row, grid_col')
    .eq('id', id2)
    .single()

  if (!status1 || !status2) {
    throw new Error('Failed to find status lists to swap')
  }

  // Swap positions
  const updatePromises = [
    supabase
      .from('statuslist')
      .update({
        grid_row: status2.grid_row,
        grid_col: status2.grid_col,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id1),
    supabase
      .from('statuslist')
      .update({
        grid_row: status1.grid_row,
        grid_col: status1.grid_col,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id2),
  ]

  const results = await Promise.all(updatePromises)
  const errorResults = results.filter((r) => r.error)
  if (errorResults.length > 0) {
    Sentry.captureException(new Error('Failed to swap status list positions'), {
      extra: {
        context: 'Swap status list positions',
        id1,
        id2,
        errors: errorResults,
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

  // Use parallel updates for performance
  const updatePromises = updates.map(({ id, gridRow, gridCol }) =>
    supabase
      .from('statuslist')
      .update({
        grid_row: gridRow,
        grid_col: gridCol,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id),
  )

  const results = await Promise.all(updatePromises)

  const errorResults = results.filter((r) => r.error)
  if (errorResults.length > 0) {
    Sentry.captureException(
      new Error('Failed to batch update status list positions'),
      {
        extra: {
          context: 'Batch update status list positions',
          errors: errorResults,
        },
      },
    )
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

  // Use a transaction-like approach with Promise.all
  const updatePromises = updates.map(({ id, statusId, order }) =>
    supabase
      .from('repocard')
      .update({
        status_id: statusId,
        order: order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id),
  )

  const results = await Promise.all(updatePromises)

  const errorResults = results.filter((r) => r.error)
  if (errorResults.length > 0) {
    Sentry.captureException(
      new Error('Failed to batch update repo card orders'),
      {
        extra: {
          context: 'Batch update repo card orders',
          errors: errorResults,
        },
      },
    )
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
  theme: string = 'sunrise',
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
    Sentry.captureException(error ?? new Error('No data returned'), {
      extra: { context: 'Create board', name, theme },
    })
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
    Sentry.captureException(error, {
      extra: { context: 'Delete board', boardId },
    })
    throw new Error('Failed to delete board')
  }

  revalidatePath('/boards')
}

/**
 * Update board settings
 */
export async function updateBoard(
  boardId: string,
  updates: { name?: string; theme?: string },
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

  revalidatePath(`/board/${boardId}`)
  revalidatePath('/boards')
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
    return { errors: { name: result.error.flatten().formErrors } }
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

  try {
    await deleteBoard(boardId)
    return { success: true }
  } catch {
    return { error: 'Failed to delete board' }
  }
}

// ========================================
// Board Theme Action (useActionState compatible)
// ========================================

/** Valid theme names for board customization */
const VALID_THEMES = [
  'sunrise',
  'sandstone',
  'mint',
  'sky',
  'lavender',
  'rose',
  'midnight',
  'graphite',
  'forest',
  'ocean',
  'plum',
  'rust',
] as const

/**
 * State returned from the update board theme action.
 */
export type UpdateBoardThemeState = {
  success?: boolean
  newTheme?: string
  error?: string
}

/**
 * Server Action for updating a board's theme.
 * Compatible with useActionState (accepts prevState as first arg).
 *
 * @param prevState - Previous state from useActionState
 * @param formData - Form data containing boardId and theme fields
 * @returns
 * - On success: { success: true, newTheme: string }
 * - On validation error: { error: 'Invalid theme' }
 * - On server error: { error: 'Failed to update theme' }
 *
 * @example
 * // In React component with useActionState
 * const [state, formAction, isPending] = useActionState(updateBoardThemeAction, {})
 * <form action={formAction}>
 *   <input type="hidden" name="boardId" value={boardId} />
 *   <input type="hidden" name="theme" value="midnight" />
 *   <button disabled={isPending}>Apply Theme</button>
 * </form>
 */
export async function updateBoardThemeAction(
  _prevState: UpdateBoardThemeState,
  formData: FormData,
): Promise<UpdateBoardThemeState> {
  const boardId = formData.get('boardId') as string
  const theme = formData.get('theme') as string

  // Validate theme is in allowed list
  if (!VALID_THEMES.includes(theme as (typeof VALID_THEMES)[number])) {
    return { error: 'Invalid theme' }
  }

  try {
    await updateBoard(boardId, { theme })
    return { success: true, newTheme: theme }
  } catch {
    return { error: 'Failed to update theme' }
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

  revalidatePath('/boards')
  revalidatePath('/boards/favorites')

  return { success: true, isFavorite: newStatus }
}

/**
 * Get favorite boards for current user.
 *
 * @returns
 * - Array of favorite boards ordered by updated_at descending
 * - Empty array if not authenticated or no favorites
 *
 * @example
 * const favorites = await getFavoriteBoards()
 * console.log(`Found ${favorites.length} favorite boards`)
 */
export async function getFavoriteBoards(): Promise<Tables<'board'>[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from('board')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_favorite', true)
    .order('updated_at', { ascending: false })

  return data || []
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
      theme: 'sunrise',
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

  // Log audit event
  try {
    await logBoardCreate(data.id)
  } catch (auditError) {
    Sentry.captureException(auditError, {
      extra: { context: 'Log board creation audit', boardId: data.id },
    })
    // Non-critical - don't block
  }

  return { id: data.id, name: data.name }
}

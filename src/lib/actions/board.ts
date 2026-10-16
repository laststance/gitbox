/**
 * Board Actions
 *
 * Server Actions for Board, StatusList, and RepoCard operations.
 * Provides Supabase integration for Kanban board functionality.
 */

'use server'

import * as Sentry from '@sentry/nextjs'
import { destr } from 'destr'

import {
  withAuthRateLimit,
  withAuthResultRateLimit,
} from '@/lib/actions/auth-guard'
import { toStatusListDomain } from '@/lib/actions/mappers'
import { getCachedClaims } from '@/lib/auth/get-cached-claims'
import { BOARD_CREATION_UNCONFIRMED_MESSAGE } from '@/lib/constants/board-creation'
import { DEFAULT_PRESET_ID, type PresetId } from '@/lib/constants/board-presets'
import type { StatusListDomain } from '@/lib/models/domain'
import { createClient } from '@/lib/supabase/server'
import type { TablesUpdate } from '@/lib/supabase/types'
import {
  boardNameSchema,
  boardSubtitleSchema,
  boardIdSchema,
  boardSettingsSchema,
  boardPositionUpdatesSchema,
  presetIdSchema,
  statusListNameSchema,
  statusListColorSchema,
  gridPositionSchema,
} from '@/lib/validations/board'

import {
  createBoardFromPreset,
  type BoardCreationOutcome,
} from './board-creation'
import {
  ActionUserError,
  type ActionErrorCode,
  type ActionResult,
  type BoardOption,
} from './types'

// ========================================
// StatusList Operations
// ========================================

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

  return withAuthRateLimit('boardCrud', async (supabase) => {
    // Get the current max grid_col in row 0. maybeSingle() returns null
    // (no error) when the board has no columns yet — that's the legitimate
    // empty case. Any other error means RLS denial, network failure, etc.,
    // and silently falling back to 0 would duplicate grid_col on the insert.
    const { data: maxColData, error: maxColError } = await supabase
      .from('statuslist')
      .select('grid_col')
      .eq('board_id', boardId)
      .eq('grid_row', 0)
      .order('grid_col', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxColError) {
      Sentry.captureException(maxColError, {
        extra: { context: 'Read max grid_col for createStatusList', boardId },
      })
      throw new Error('Failed to create status list')
    }

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

    return toStatusListDomain(data)
  })
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

  return withAuthRateLimit('boardCrud', async (supabase) => {
    const updateData: TablesUpdate<'statuslist'> = {}
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
  })
}

/**
 * Delete a status list
 */
export async function deleteStatusList(
  statusId: string,
  boardId: string,
): Promise<void> {
  return withAuthRateLimit('boardCrud', async (supabase) => {
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
  })
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

  return withAuthRateLimit('batchDnD', async (supabase) => {
    const { error } = await supabase
      .from('statuslist')
      .update({
        grid_row: gridRow,
        grid_col: gridCol,
      })
      .eq('id', id)

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update status list position', id, gridRow, gridCol },
      })
      throw new Error('Failed to update column position')
    }
  })
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
  return withAuthRateLimit('batchDnD', async (supabase) => {
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
  })
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
  return withAuthRateLimit('batchDnD', async (supabase) => {
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
  })
}

// ========================================
// RepoCard Operations
// ========================================

/**
 * Update repo card position (status and/or order)
 * Used for drag & drop operations
 */
export async function updateRepoCardPosition(
  cardId: string,
  statusId: string,
  order: number,
): Promise<void> {
  return withAuthRateLimit('batchDnD', async (supabase) => {
    const { error } = await supabase
      .from('repocard')
      .update({
        status_id: statusId,
        order: order,
      })
      .eq('id', cardId)

    if (error) {
      Sentry.captureException(error, {
        extra: {
          context: 'Update repo card position',
          cardId,
          statusId,
          order,
        },
      })
      throw new Error('Failed to update repo card position')
    }
  })
}

/**
 * Batch update repo card orders
 * Used when reordering multiple cards within a column
 */
export async function batchUpdateRepoCardOrders(
  updates: Array<{ id: string; statusId: string; order: number }>,
): Promise<void> {
  return withAuthRateLimit('batchDnD', async (supabase) => {
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
  })
}

// ========================================
// Board Operations
// ========================================

/**
 * What {@link createBoard} answers when it cannot hand back a board, by the
 * `status` of the {@link createBoardFromPreset} outcome.
 * - `not-created`: the database refused and nothing was written, so trying
 *   again is safe and the text says so
 * - `unconfirmed`: no answer came, so the board may exist and a second try
 *   could make a second one
 * - `unreadable`: the board exists but cannot be handed back. The same text
 *   sends the user to their boards, where it is.
 *
 * The last two carry `BOARD_CREATION_UNCONFIRMED`: the client offers the
 * boards for them and no second try, and it reads the code for that, not the
 * text.
 */
const BOARD_CREATION_FAILURES = {
  'not-created': {
    message: 'The board was not created. Try again.',
    errorCode: undefined,
  },
  unconfirmed: {
    message: BOARD_CREATION_UNCONFIRMED_MESSAGE,
    errorCode: 'BOARD_CREATION_UNCONFIRMED',
  },
  unreadable: {
    message: BOARD_CREATION_UNCONFIRMED_MESSAGE,
    errorCode: 'BOARD_CREATION_UNCONFIRMED',
  },
} as const satisfies Record<
  Exclude<BoardCreationOutcome['status'], 'created'>,
  { message: string; errorCode: ActionErrorCode | undefined }
>

/**
 * Creates a board with the columns of a preset. Board and columns are written
 * in one transaction (see {@link createBoardFromPreset}), so a refused
 * creation leaves nothing behind and can be tried again.
 *
 * Called by {@link CreateBoardForm} on `/boards/new` with one of
 * {@link SELECTABLE_PRESET_IDS}, and by {@link MoveToAnotherBoardDialog} with
 * `single-column` for a destination board made inside the dialog.
 *
 * @param name - Board name as typed; validated and trimmed here (1 to 50 characters).
 * @param presetId - One of {@link PRESET_IDS}; `web-app` when left out. Checked
 *   here again, because a browser can send any string.
 * @returns
 * - On success: `{ success: true, data: { id, name, statusLists } }`, the
 *   columns in their order
 * - Invalid name or preset: `{ success: false, error }` with the validation message
 * - Not signed in: `{ success: false, error: 'Authentication required' }`
 * - The database refused, so nothing was written:
 *   `{ success: false, error: 'The board was not created. Try again.' }`
 * - No answer came from the database, so the board may exist, or the board
 *   was created and its answer could not be read:
 *   `{ success: false, error: BOARD_CREATION_UNCONFIRMED_MESSAGE, errorCode: 'BOARD_CREATION_UNCONFIRMED' }`
 * @example
 * await createBoard('Side Projects', 'single-column')
 * // => { success: true, data: { id: 'uuid', name: 'Side Projects',
 * //      statusLists: [{ id: 'uuid', name: 'Repositories', color: '#6B7280' }] } }
 */
export async function createBoard(
  name: string,
  presetId?: PresetId,
): Promise<ActionResult<BoardOption>> {
  // Validate board name (P2-3)
  const nameValidation = boardNameSchema.safeParse(name)
  if (!nameValidation.success) {
    return {
      success: false,
      error: nameValidation.error.issues[0]?.message || 'Invalid board name',
    }
  }

  // Validate preset ID (default to 'web-app' if omitted)
  const resolvedPresetId = presetId ?? DEFAULT_PRESET_ID
  const presetValidation = presetIdSchema.safeParse(resolvedPresetId)
  if (!presetValidation.success) {
    return { success: false, error: 'Invalid preset selection' }
  }

  return withAuthResultRateLimit('boardCrud', async (supabase) => {
    // The validated name, not `name`: the schema trims what the user typed
    const outcome = await createBoardFromPreset(
      supabase,
      nameValidation.data,
      presetValidation.data,
    )

    if (outcome.status === 'created') return outcome.board

    Sentry.captureException(outcome.error, {
      extra: {
        context: 'createBoard: create_board_with_status_lists',
        presetId: presetValidation.data,
        status: outcome.status,
      },
    })
    // The outcomes differ in what the user is told about trying again
    const failure = BOARD_CREATION_FAILURES[outcome.status]
    throw new ActionUserError(failure.message, failure.errorCode)
  })
}

/**
 * Batch update board positions for DnD reordering.
 * Updates multiple boards' position values atomically via a PostgreSQL RPC.
 *
 * @param updates - Array of { id, position } pairs
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On validation error: `{ success: false, error: string }`
 * - On auth/DB error: `{ success: false, error: string }`
 *
 * @example
 * const result = await updateBoardPositions([
 *   { id: 'board-uuid-1', position: 1 },
 *   { id: 'board-uuid-2', position: 0 },
 * ])
 * if (!result.success) toast.error(result.error)
 */
export async function updateBoardPositions(
  updates: Array<{ id: string; position: number }>,
): Promise<ActionResult<void>> {
  const validation = boardPositionUpdatesSchema.safeParse(updates)
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid position updates',
    }
  }

  return withAuthResultRateLimit('batchDnD', async (supabase) => {
    // Atomic batch update via PostgreSQL RPC — all updates succeed or all fail
    // Note: RLS policies on board table still enforce user ownership
    const { error } = await supabase.rpc('batch_update_board_positions', {
      p_updates: updates.map(({ id, position }) => ({ id, position })),
    })

    if (error) {
      throw new Error('Failed to update board positions')
    }
  })
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

  const actionResult = await withAuthResultRateLimit(
    'boardCrud',
    async (supabase) => {
      const { data, error } = await supabase
        .from('board')
        .update({ name: result.data })
        .eq('id', boardId)
        .select('id')

      if (error) {
        Sentry.captureException(error, {
          extra: { context: 'Rename board', boardId, name: result.data },
        })
        throw new Error('Failed to rename board')
      }

      if (!data || data.length === 0) {
        Sentry.captureMessage('Rename board: no rows updated', {
          level: 'warning',
          extra: { boardId, name: result.data },
        })
        throw new Error('Board not found')
      }
    },
  )

  if (!actionResult.success) {
    return { errors: { name: [actionResult.error] } }
  }

  return { success: true, newName: result.data }
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

  const actionResult = await withAuthResultRateLimit(
    'boardCrud',
    async (supabase) => {
      const { data, error } = await supabase
        .from('board')
        .delete()
        .eq('id', idResult.data)
        .select('id')

      if (error) {
        Sentry.captureException(error, {
          extra: { context: 'Delete board', boardId: idResult.data },
        })
        throw new Error('Failed to delete board')
      }

      if (!data || data.length === 0) {
        Sentry.captureMessage('Delete board: no rows deleted', {
          level: 'warning',
          extra: { boardId: idResult.data },
        })
        throw new Error('Board not found')
      }
    },
  )

  if (!actionResult.success) {
    return { error: actionResult.error }
  }

  return { success: true }
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
  const authedContext = await getCachedClaims()
  if (!authedContext) {
    return { success: false, error: 'Authentication required' }
  }
  const { supabase, claims } = authedContext

  // Get current status
  const { data: board, error: fetchError } = await supabase
    .from('board')
    .select('is_favorite')
    .eq('id', boardId)
    .eq('user_id', claims.sub)
    .single()

  if (fetchError || !board) {
    return { success: false, error: 'Board not found' }
  }

  // Toggle
  const newStatus = !board.is_favorite
  const { error: updateError } = await supabase
    .from('board')
    .update({ is_favorite: newStatus })
    .eq('id', boardId)

  if (updateError) {
    return { success: false, error: 'Failed to update favorite' }
  }

  return { success: true, isFavorite: newStatus }
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
  const parsed = destr(settingsJson)
  if (typeof parsed === 'string') {
    return { error: 'Invalid settings format' }
  }
  const settingsResult = boardSettingsSchema.safeParse(parsed)
  if (!settingsResult.success) {
    return {
      error: settingsResult.error.issues.map((i) => i.message).join(', '),
    }
  }
  const newSettings = settingsResult.data as Record<string, unknown>

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

// ============================================================================
// Inline Edit Actions (direct call, not form-based)
// ============================================================================

/**
 * Rename a board directly (non-form version for inline editing).
 *
 * @param boardId - UUID of the board to rename
 * @param name - New board name (1-50 chars, trimmed)
 * @returns
 * - On success: { success: true, data: { name: string } }
 * - On validation error: { success: false, error: string }
 * - On server error: { success: false, error: 'Failed to rename board' }
 *
 * @example
 * const result = await renameBoardDirect('board-123', 'New Name')
 * if (result.success) {
 *   handleRenameSuccess(result.data.name)
 * }
 */
export async function renameBoardDirect(
  boardId: string,
  name: string,
): Promise<ActionResult<{ name: string }>> {
  const idResult = boardIdSchema.safeParse(boardId)
  if (!idResult.success) {
    return { success: false, error: 'Invalid board ID' }
  }

  const nameResult = boardNameSchema.safeParse(name)
  if (!nameResult.success) {
    return {
      success: false,
      error: nameResult.error.issues[0]?.message || 'Invalid board name',
    }
  }

  return withAuthResultRateLimit('boardCrud', async (supabase) => {
    const { error } = await supabase
      .from('board')
      .update({ name: nameResult.data })
      .eq('id', idResult.data)

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Rename board (direct)', boardId: idResult.data },
      })
      throw new Error('Failed to rename board')
    }

    return { name: nameResult.data }
  })
}

/**
 * Update board subtitle (for inline editing in header).
 *
 * @param boardId - UUID of the board
 * @param subtitle - New subtitle (0-100 chars, trimmed). Empty string clears subtitle.
 * @returns
 * - On success: { success: true, data: { subtitle: string } }
 * - On validation error: { success: false, error: string }
 * - On server error: { success: false, error: 'Failed to update subtitle' }
 *
 * @example
 * const result = await updateBoardSubtitle('board-123', 'My awesome project')
 * if (result.success) {
 *   handleSubtitleChange(result.data.subtitle)
 * }
 */
export async function updateBoardSubtitle(
  boardId: string,
  subtitle: string,
): Promise<ActionResult<{ subtitle: string }>> {
  const idResult = boardIdSchema.safeParse(boardId)
  if (!idResult.success) {
    return { success: false, error: 'Invalid board ID' }
  }

  const subtitleResult = boardSubtitleSchema.safeParse(subtitle)
  if (!subtitleResult.success) {
    return {
      success: false,
      error: subtitleResult.error.issues[0]?.message || 'Invalid subtitle',
    }
  }

  // Store empty string as null in DB for cleaner querying
  const dbValue = subtitleResult.data === '' ? null : subtitleResult.data

  return withAuthResultRateLimit('boardCrud', async (supabase) => {
    const { error } = await supabase
      .from('board')
      .update({ subtitle: dbValue })
      .eq('id', idResult.data)

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update board subtitle', boardId: idResult.data },
      })
      throw new Error('Failed to update subtitle')
    }

    return { subtitle: subtitleResult.data }
  })
}

/**
 * Toggle board subtitle visibility in board settings JSON.
 *
 * @param boardId - UUID of the board
 * @param show - Whether to display the subtitle in the header
 * @returns
 * - On success: { success: true, data: { showSubtitle: boolean } }
 * - On failure: { success: false, error: string }
 *
 * @example
 * const result = await toggleBoardSubtitleVisibility('board-123', false)
 * if (result.success) {
 *   handleShowSubtitleChange(result.data.showSubtitle)
 * }
 */
export async function toggleBoardSubtitleVisibility(
  boardId: string,
  show: boolean,
): Promise<ActionResult<{ showSubtitle: boolean }>> {
  const idResult = boardIdSchema.safeParse(boardId)
  if (!idResult.success) {
    return { success: false, error: 'Invalid board ID' }
  }

  return withAuthResultRateLimit('boardCrud', async (supabase) => {
    // Read current settings
    const { data: board, error: fetchError } = await supabase
      .from('board')
      .select('settings')
      .eq('id', idResult.data)
      .single()

    if (fetchError || !board) {
      throw new Error('Failed to fetch board settings')
    }

    // Merge showSubtitle into existing settings
    const existing = (board.settings as Record<string, unknown>) || {}
    const merged = { ...existing, showSubtitle: show }

    const { error: updateError } = await supabase
      .from('board')
      .update({ settings: merged as unknown as Record<string, never> })
      .eq('id', idResult.data)

    if (updateError) {
      Sentry.captureException(updateError, {
        extra: {
          context: 'Toggle board subtitle visibility',
          boardId: idResult.data,
        },
      })
      throw new Error('Failed to update subtitle visibility')
    }

    return { showSubtitle: show }
  })
}

/**
 * Maintenance Project Info CRUD Operations
 *
 * Thin wrappers around shared-project-info.ts core functions.
 * All logic is centralized in the shared module; this file only provides
 * the 'use server' boundary, binds the maintenance_id foreign key,
 * and returns ActionResult<T> for type-safe error handling.
 *
 * @see shared-project-info.ts for core implementation
 * @see project-info.ts for RepoCard-linked wrappers
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import type { CommentColor } from '@/lib/supabase/types'

import { withAuthResultRateLimit } from './auth-guard'
import {
  getProjectInfoCore,
  upsertProjectInfoCore,
  getCommentsCore,
  updateCommentCore,
  updateCommentColorCore,
  deleteCommentCore,
  type FkConfig,
  type ProjectInfoData,
  type CommentData,
} from './shared-project-info'
import type { ActionResult } from './types'
export type {
  ProjectLink,
  ProjectInfoData,
  CommentData,
} from './shared-project-info'

const FK: FkConfig = {
  column: 'maintenance_id',
  label: 'maintenance project info',
}

/**
 * Get project info for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @returns
 * - On success: `{ success: true, data: ProjectInfoData | null }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await getMaintenanceProjectInfo('maint-uuid-123')
 * if (result.success) console.log(result.data)
 */
export async function getMaintenanceProjectInfo(
  maintenanceId: string,
): Promise<ActionResult<ProjectInfoData | null>> {
  try {
    const data = await getProjectInfoCore(FK, maintenanceId)
    return { success: true, data }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'getMaintenanceProjectInfo', maintenanceId },
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch maintenance project info',
    }
  }
}

/**
 * Create or update project info for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @param data - ProjectInfoData to save
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * await upsertMaintenanceProjectInfo('maint-uuid-123', {
 *   note: 'Rich text content...',
 *   comment: 'Inline comment',
 *   links: [{ type: 'vercel', url: 'https://...' }]
 * })
 */
export async function upsertMaintenanceProjectInfo(
  maintenanceId: string,
  data: ProjectInfoData,
): Promise<ActionResult<void>> {
  try {
    await upsertProjectInfoCore(FK, maintenanceId, data)
    return { success: true, data: undefined }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'upsertMaintenanceProjectInfo', maintenanceId },
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to save maintenance project info',
    }
  }
}

/**
 * Get comments for multiple maintenance items (batch fetch)
 *
 * @param maintenanceIds - Array of maintenance IDs
 * @returns
 * - On success: `{ success: true, data: Record<string, CommentData> }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await getCommentsForMaintenanceItems(['maint-1', 'maint-2'])
 * if (result.success) console.log(result.data['maint-1'])
 */
export async function getCommentsForMaintenanceItems(
  maintenanceIds: string[],
): Promise<ActionResult<Record<string, CommentData>>> {
  try {
    const data = await getCommentsCore(FK, maintenanceIds)
    return { success: true, data }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'getCommentsForMaintenanceItems', maintenanceIds },
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to fetch comments',
    }
  }
}

/**
 * Update comment for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @param comment - New comment text (max 2000 chars)
 * @param color - Optional color for the comment
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await updateMaintenanceComment('maint-1', 'Updated comment text')
 */
export async function updateMaintenanceComment(
  maintenanceId: string,
  comment: string,
  color?: CommentColor,
): Promise<ActionResult<void>> {
  try {
    await updateCommentCore(FK, maintenanceId, comment, color)
    return { success: true, data: undefined }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'updateMaintenanceComment', maintenanceId },
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update comment',
    }
  }
}

/**
 * Update comment color for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @param color - New color to set
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await updateMaintenanceCommentColor('maint-1', 'blue')
 */
export async function updateMaintenanceCommentColor(
  maintenanceId: string,
  color: CommentColor,
): Promise<ActionResult<void>> {
  try {
    await updateCommentColorCore(FK, maintenanceId, color)
    return { success: true, data: undefined }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'updateMaintenanceCommentColor', maintenanceId },
    })
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update comment color',
    }
  }
}

/**
 * Delete comment for a maintenance item
 *
 * Clears the comment text and resets color to default.
 * Does NOT delete the projectinfo row (preserves note, links).
 *
 * @param maintenanceId - Maintenance record ID
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await deleteMaintenanceComment('maint-1')
 */
export async function deleteMaintenanceComment(
  maintenanceId: string,
): Promise<ActionResult<void>> {
  try {
    await deleteCommentCore(FK, maintenanceId)
    return { success: true, data: undefined }
  } catch (error) {
    Sentry.captureException(error, {
      extra: { context: 'deleteMaintenanceComment', maintenanceId },
    })
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete comment',
    }
  }
}

/**
 * Delete a maintenance item permanently
 *
 * Removes the maintenance record from the database.
 * Associated projectinfo is automatically cleaned up via FK ON DELETE CASCADE.
 * Protected by authentication and rate limiting.
 *
 * @param maintenanceId - Maintenance record ID to delete
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await deleteMaintenanceItem('maint-uuid-123')
 * if (result.success) console.log('Deleted')
 */
export async function deleteMaintenanceItem(
  maintenanceId: string,
): Promise<ActionResult<void>> {
  return withAuthResultRateLimit('boardCrud', async (supabase, user) => {
    const { error: deleteError } = await supabase
      .from('maintenance')
      .delete()
      .eq('id', maintenanceId)
      .eq('user_id', user.id)

    if (deleteError) {
      Sentry.captureException(deleteError, {
        extra: { context: 'deleteMaintenanceItem', maintenanceId },
      })
      throw new Error('Failed to delete maintenance item')
    }
  })
}

/**
 * State type for deleteMaintenanceItemAction form action
 */
export type DeleteMaintenanceState = {
  success?: boolean
  error?: string
}

/**
 * Form action wrapper for deleteMaintenanceItem (used with useActionState)
 *
 * @param _prevState - Previous form state (unused, required by useActionState)
 * @param formData - FormData containing maintenanceId
 * @returns Updated form state with success or error
 *
 * @example
 * const [state, formAction, isPending] = useActionState(deleteMaintenanceItemAction, {})
 */
export async function deleteMaintenanceItemAction(
  _prevState: DeleteMaintenanceState,
  formData: FormData,
): Promise<DeleteMaintenanceState> {
  const maintenanceId = formData.get('maintenanceId') as string

  if (!maintenanceId) {
    return { error: 'Missing maintenance ID' }
  }

  const result = await deleteMaintenanceItem(maintenanceId)
  if (result.success) {
    return { success: true }
  }
  return { error: result.error }
}

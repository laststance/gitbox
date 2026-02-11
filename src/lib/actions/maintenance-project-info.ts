/**
 * Maintenance Project Info CRUD Operations
 *
 * Thin wrappers around shared-project-info.ts core functions.
 * All logic is centralized in the shared module; this file only provides
 * the 'use server' boundary and binds the maintenance_id foreign key.
 *
 * @see shared-project-info.ts for core implementation
 * @see project-info.ts for RepoCard-linked wrappers
 */

'use server'

import type { CommentColor } from '@/lib/supabase/types'

import {
  getProjectInfoCore,
  upsertProjectInfoCore,
  getCommentsCore,
  updateCommentCore,
  updateCommentColorCore,
  deleteCommentCore,
  type FkConfig,
  type ProjectInfoData,
} from './shared-project-info'
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
 * @returns ProjectInfoData with note, comment, and links
 *
 * @example
 * const info = await getMaintenanceProjectInfo('maint-uuid-123')
 * // Returns: { note: '...', comment: '...', links: [...] }
 */
export async function getMaintenanceProjectInfo(maintenanceId: string) {
  return getProjectInfoCore(FK, maintenanceId)
}

/**
 * Create or update project info for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @param data - ProjectInfoData to save
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
) {
  return upsertProjectInfoCore(FK, maintenanceId, data)
}

/**
 * Get comments for multiple maintenance items (batch fetch)
 *
 * @param maintenanceIds - Array of maintenance IDs
 * @returns Map of maintenance ID to CommentData
 *
 * @example
 * const comments = await getCommentsForMaintenanceItems(['maint-1', 'maint-2'])
 * // Returns: { 'maint-1': { comment: 'text', color: 'primary' }, ... }
 */
export async function getCommentsForMaintenanceItems(maintenanceIds: string[]) {
  return getCommentsCore(FK, maintenanceIds)
}

/**
 * Update comment for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @param comment - New comment text (max 2000 chars)
 * @param color - Optional color for the comment
 *
 * @example
 * await updateMaintenanceComment('maint-1', 'Updated comment text')
 * await updateMaintenanceComment('maint-1', 'With color', 'blue')
 */
export async function updateMaintenanceComment(
  maintenanceId: string,
  comment: string,
  color?: CommentColor,
) {
  return updateCommentCore(FK, maintenanceId, comment, color)
}

/**
 * Update comment color for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @param color - New color to set
 *
 * @example
 * await updateMaintenanceCommentColor('maint-1', 'blue')
 */
export async function updateMaintenanceCommentColor(
  maintenanceId: string,
  color: CommentColor,
) {
  return updateCommentColorCore(FK, maintenanceId, color)
}

/**
 * Delete comment for a maintenance item
 *
 * Clears the comment text and resets color to default.
 * Does NOT delete the projectinfo row (preserves note, links).
 *
 * @param maintenanceId - Maintenance record ID
 *
 * @example
 * await deleteMaintenanceComment('maint-1')
 */
export async function deleteMaintenanceComment(maintenanceId: string) {
  return deleteCommentCore(FK, maintenanceId)
}

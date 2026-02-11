/**
 * Project Info CRUD Operations (RepoCard-linked)
 *
 * Thin wrappers around shared-project-info.ts core functions.
 * All logic is centralized in the shared module; this file only provides
 * the 'use server' boundary and binds the repo_card_id foreign key.
 *
 * @see shared-project-info.ts for core implementation
 * @see maintenance-project-info.ts for Maintenance-linked wrappers
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

const FK: FkConfig = { column: 'repo_card_id', label: 'project info' }

/**
 * Get project info for a repo card
 *
 * @param repoCardId - RepoCard ID
 * @returns ProjectInfoData with note, comment, and links
 *
 * @example
 * const info = await getProjectInfo('card-uuid-123')
 * // Returns: { note: '...', comment: '...', links: [...] }
 */
export async function getProjectInfo(repoCardId: string) {
  return getProjectInfoCore(FK, repoCardId)
}

/**
 * Create or update project info for a repo card
 *
 * @param repoCardId - RepoCard ID
 * @param data - ProjectInfoData to save
 *
 * @example
 * await upsertProjectInfo('card-uuid-123', {
 *   note: 'Rich text content...',
 *   comment: 'Inline comment',
 *   links: [{ type: 'vercel', url: 'https://...' }]
 * })
 */
export async function upsertProjectInfo(
  repoCardId: string,
  data: ProjectInfoData,
) {
  return upsertProjectInfoCore(FK, repoCardId, data)
}

/**
 * Get comments for multiple repo cards (batch fetch)
 *
 * @param repoCardIds - Array of repo card IDs
 * @returns Map of repo card ID to CommentData
 *
 * @example
 * const comments = await getCommentsForCards(['card-1', 'card-2'])
 * // Returns: { 'card-1': { comment: 'text', color: 'primary' }, ... }
 */
export async function getCommentsForCards(repoCardIds: string[]) {
  return getCommentsCore(FK, repoCardIds)
}

/**
 * Update comment for a single repo card
 *
 * @param repoCardId - RepoCard ID
 * @param comment - New comment text (max 2000 chars)
 * @param color - Optional color for the comment
 *
 * @example
 * await updateComment('card-1', 'Updated comment text')
 * await updateComment('card-1', 'With color', 'blue')
 */
export async function updateComment(
  repoCardId: string,
  comment: string,
  color?: CommentColor,
) {
  return updateCommentCore(FK, repoCardId, comment, color)
}

/**
 * Update comment color for a single repo card
 *
 * @param repoCardId - RepoCard ID
 * @param color - New color to set
 *
 * @example
 * await updateCommentColor('card-1', 'blue')
 */
export async function updateCommentColor(
  repoCardId: string,
  color: CommentColor,
) {
  return updateCommentColorCore(FK, repoCardId, color)
}

/**
 * Delete comment for a single repo card
 *
 * Clears the comment text and resets color to default.
 * Does NOT delete the projectinfo row (preserves note, links).
 *
 * @param repoCardId - RepoCard ID
 *
 * @example
 * await deleteComment('card-1')
 */
export async function deleteComment(repoCardId: string) {
  return deleteCommentCore(FK, repoCardId)
}

/**
 * Project Info CRUD Operations
 *
 * Thin wrappers around project-info-core.ts core functions.
 * All logic is centralized in the core module; this file only provides
 * the 'use server' boundary. The read goes through {@link withAuthResult}.
 * Each write goes through {@link withAuthResultRateLimit} on the
 * `projectInfo` key: a signed-in browser can call them with any arguments,
 * and the rows they make survive the card. A sentence the core throws as
 * {@link ActionUserError} reaches the Note dialog; any other failure becomes
 * the guard's generic message.
 *
 * @see project-info-core.ts for core implementation
 */

'use server'

import type { CommentColor } from '@/lib/supabase/types'

import { withAuthResult, withAuthResultRateLimit } from './auth-guard'
import {
  getProjectInfoCore,
  upsertProjectInfoCore,
  updateCommentCore,
  updateCommentColorCore,
  deleteCommentCore,
  type ProjectInfoData,
} from './project-info-core'
import type { ActionResult } from './types'
export type {
  ProjectLink,
  ProjectInfoData,
  CommentData,
} from './project-info-core'

/**
 * Get project info for a repo card
 *
 * @param repoCardId - RepoCard ID
 * @returns
 * - On success: `{ success: true, data: ProjectInfoData | null }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await getProjectInfo('card-uuid-123')
 * if (result.success) console.log(result.data)
 */
export async function getProjectInfo(
  repoCardId: string,
): Promise<ActionResult<ProjectInfoData | null>> {
  // A read: no rate limit. A sentence from the core reaches the Note dialog;
  // anything else becomes the guard's generic message.
  return withAuthResult(async () => getProjectInfoCore(repoCardId))
}

/**
 * Create or update project info for a repo card
 *
 * @param repoCardId - RepoCard ID
 * @param data - ProjectInfoData to save
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await upsertProjectInfo('card-uuid-123', {
 *   note: 'Rich text content...',
 *   comment: 'Inline comment',
 *   links: [{ type: 'vercel', url: 'https://...' }]
 * })
 */
export async function upsertProjectInfo(
  repoCardId: string,
  data: ProjectInfoData,
): Promise<ActionResult<void>> {
  return withAuthResultRateLimit('projectInfo', async () => {
    await upsertProjectInfoCore(repoCardId, data)
  })
}

/**
 * Update comment for a single repo card
 *
 * @param repoCardId - RepoCard ID
 * @param comment - New comment text (max 2000 chars)
 * @param color - Optional color for the comment
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await updateComment('card-1', 'Updated comment text')
 */
export async function updateComment(
  repoCardId: string,
  comment: string,
  color?: CommentColor,
): Promise<ActionResult<void>> {
  return withAuthResultRateLimit('projectInfo', async () => {
    await updateCommentCore(repoCardId, comment, color)
  })
}

/**
 * Update comment color for a single repo card
 *
 * @param repoCardId - RepoCard ID
 * @param color - New color to set
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await updateCommentColor('card-1', 'blue')
 */
export async function updateCommentColor(
  repoCardId: string,
  color: CommentColor,
): Promise<ActionResult<void>> {
  return withAuthResultRateLimit('projectInfo', async () => {
    await updateCommentColorCore(repoCardId, color)
  })
}

/**
 * Delete comment for a single repo card
 *
 * Clears the comment text and resets color to default.
 * Does NOT delete the projectinfo row (preserves note, links).
 *
 * @param repoCardId - RepoCard ID
 * @returns
 * - On success: `{ success: true, data: undefined }`
 * - On error: `{ success: false, error: string }`
 *
 * @example
 * const result = await deleteComment('card-1')
 */
export async function deleteComment(
  repoCardId: string,
): Promise<ActionResult<void>> {
  return withAuthResultRateLimit('projectInfo', async () => {
    await deleteCommentCore(repoCardId)
  })
}

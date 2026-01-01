/**
 * Project Info CRUD Operations
 *
 * Constitution requirements:
 * - Principle V: Security first (input validation, XSS prevention)
 *
 * User Story 4:
 * - Quick note: Rich text memo (20000 character limit)
 * - Links: 55 built-in presets + user-defined custom presets
 *   @see lib/constants/link-presets.ts for available presets
 *   @see lib/actions/user-presets.ts for custom preset CRUD
 * - Comment: Inline text displayed on Card (2000 character limit)
 * - Supabase integration for persistent storage
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import { createClient } from '@/lib/supabase/server'
import type {
  TablesInsert,
  Tables,
  TablesUpdate,
  CommentColor,
} from '@/lib/supabase/types'
import {
  noteSchema,
  commentSchema,
  commentColorSchema,
  projectLinkUrlSchema,
  DEFAULT_COMMENT_COLOR,
} from '@/lib/validations/project-info'

type ProjectInfoRow = Tables<'projectinfo'>
type ProjectInfoInsert = TablesInsert<'projectinfo'>
type ProjectInfoUpdate = TablesUpdate<'projectinfo'>

/**
 * Project link with flexible type
 *
 * The `type` field can be:
 * - A built-in preset value (e.g., 'vercel', 'sentry', 'notion')
 * - A user-defined custom preset value (e.g., 'my-service')
 * - Legacy values from old format ('production', 'tracking', 'supabase')
 */
export interface ProjectLink {
  url: string
  type: string
}

/**
 * Old links format (for backward compatibility)
 * Used before the 55-preset system was implemented
 */
interface LegacyLinksJson {
  production?: string[]
  tracking?: string[]
  supabase?: string[]
}

/**
 * Normalize links from DB to array format
 *
 * Handles both old format (categorized object) and new format (array of objects).
 * This ensures backward compatibility during the transition period.
 *
 * @param links - Links data from database (could be old or new format)
 * @returns Normalized array of ProjectLink objects
 *
 * @example
 * // Old format input:
 * normalizeLinks({ production: ['url1'], tracking: ['url2'] })
 * // Returns: [{ type: 'production', url: 'url1' }, { type: 'tracking', url: 'url2' }]
 *
 * // New format input:
 * normalizeLinks([{ type: 'vercel', url: 'url1' }])
 * // Returns: [{ type: 'vercel', url: 'url1' }]
 */
function normalizeLinks(links: unknown): ProjectLink[] {
  // Handle null/undefined
  if (!links) {
    return []
  }

  // New format: array of objects
  if (Array.isArray(links)) {
    return links
      .filter(
        (link): link is { type: string; url: string } =>
          typeof link === 'object' &&
          link !== null &&
          typeof link.type === 'string' &&
          typeof link.url === 'string',
      )
      .map((link) => ({ type: link.type, url: link.url }))
  }

  // Old format: categorized object { production: [...], tracking: [...], supabase: [...] }
  if (typeof links === 'object' && links !== null) {
    const oldFormat = links as LegacyLinksJson
    const result: ProjectLink[] = []

    if (oldFormat.production) {
      for (const url of oldFormat.production) {
        result.push({ type: 'production', url })
      }
    }
    if (oldFormat.tracking) {
      for (const url of oldFormat.tracking) {
        result.push({ type: 'tracking', url })
      }
    }
    if (oldFormat.supabase) {
      for (const url of oldFormat.supabase) {
        result.push({ type: 'supabase', url })
      }
    }

    return result
  }

  return []
}

export interface ProjectInfoData {
  note: string
  comment: string
  links: ProjectLink[]
}

/**
 * Comment data returned by getCommentsForCards
 */
export interface CommentData {
  comment: string
  color: CommentColor
}

// ========================================
// Zod-based Validation Wrappers (throw on error for backward compatibility)
// ========================================

/**
 * Validate note content using Zod schema.
 * @throws Error if validation fails
 */
function validateNote(note: string): boolean {
  const result = noteSchema.safeParse(note)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid note')
  }
  return true
}

/**
 * Validate comment content using Zod schema.
 * @throws Error if validation fails
 */
function validateComment(comment: string): boolean {
  const result = commentSchema.safeParse(comment)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid comment')
  }
  return true
}

/**
 * Validate comment color using Zod schema.
 * @throws Error if validation fails
 */
function validateCommentColor(color: string): color is CommentColor {
  const result = commentColorSchema.safeParse(color)
  if (!result.success) {
    throw new Error(`Invalid comment color: ${color}`)
  }
  return true
}

/**
 * Validate URL using Zod schema.
 * @throws Error if validation fails
 */
function validateUrl(url: string): boolean {
  const result = projectLinkUrlSchema.safeParse(url)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid URL')
  }
  return true
}

/**
 * Get project info
 */
export async function getProjectInfo(
  repoCardId: string,
): Promise<ProjectInfoData | null> {
  const supabase = await createClient()

  const { data: projectInfo, error: infoError } = await supabase
    .from('projectinfo')
    .select('*')
    .eq('repo_card_id', repoCardId)
    .single<ProjectInfoRow>()

  if (infoError) {
    if (infoError.code === 'PGRST116') {
      // Return empty state if data doesn't exist
      return { note: '', comment: '', links: [] }
    }
    Sentry.captureException(infoError, {
      extra: { context: 'Fetch project info', repoCardId },
    })
    throw new Error('Failed to fetch project information')
  }

  return {
    note: projectInfo.note || '',
    comment: projectInfo.comment || '',
    links: normalizeLinks(projectInfo.links),
  }
}

/**
 * Create or update project info
 */
export async function upsertProjectInfo(
  repoCardId: string,
  data: ProjectInfoData,
): Promise<void> {
  const supabase = await createClient()

  // Validation
  validateNote(data.note)
  validateComment(data.comment)
  data.links.forEach((link) => {
    if (link.url) {
      validateUrl(link.url)
    }
  })

  // Note: note is stored as JSON (Slate format) for rich text.
  // JSON is inherently safe when stored as a string and parsed client-side.
  // No HTML escaping needed for the note content.
  // XSS is prevented because the Plate editor renders content safely.
  // Comment is plain text for inline Card-in-Card display.

  // Store links as array of objects (new format)
  // Filter out empty URLs and ensure valid structure
  const linksArray = data.links
    .filter((link) => link.url && link.url.trim() !== '')
    .map((link) => ({ type: link.type, url: link.url }))

  try {
    // project_info upsert
    const { data: existingInfo } = await supabase
      .from('projectinfo')
      .select('id')
      .eq('repo_card_id', repoCardId)
      .single<{ id: string }>()

    if (existingInfo) {
      // Update
      const updateData: ProjectInfoUpdate = {
        note: data.note,
        comment: data.comment,
        links: linksArray,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('projectinfo')
        .update(updateData)
        .eq('id', existingInfo.id)

      if (updateError) {
        Sentry.captureException(updateError, {
          extra: { context: 'Update project info', repoCardId },
        })
        throw new Error('Failed to update project information')
      }
    } else {
      // Create new
      const insertData: ProjectInfoInsert = {
        repo_card_id: repoCardId,
        note: data.note,
        comment: data.comment,
        links: linksArray,
      }

      const { error: createError } = await supabase
        .from('projectinfo')
        .insert(insertData)

      if (createError) {
        Sentry.captureException(createError, {
          extra: { context: 'Create project info', repoCardId },
        })
        throw new Error('Failed to create project information')
      }
    }

    // Note: No revalidatePath needed - Next.js v16 doesn't cache Supabase requests
    // Client handles state updates via Redux optimistic updates
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An error occurred while saving project information')
  }
}

/**
 * Get comments for multiple repo cards (batch fetch)
 *
 * Efficiently fetches comment and color fields for multiple cards in a single query.
 * Used when loading a board to display inline comments on RepoCards.
 *
 * @param repoCardIds - Array of repo card IDs to fetch comments for
 * @returns Map of repo card ID to CommentData (comment text + color)
 *
 * @example
 * const comments = await getCommentsForCards(['card-1', 'card-2'])
 * // Returns: { 'card-1': { comment: 'Some comment', color: 'primary' }, ... }
 */
export async function getCommentsForCards(
  repoCardIds: string[],
): Promise<Record<string, CommentData>> {
  const emptyComment: CommentData = {
    comment: '',
    color: DEFAULT_COMMENT_COLOR,
  }

  if (repoCardIds.length === 0) {
    return {}
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projectinfo')
    .select('repo_card_id, comment, comment_color')
    .in('repo_card_id', repoCardIds)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Batch fetch comments', repoCardIds },
    })
    // Return empty map on error (non-critical)
    return {}
  }

  // Convert to map
  const commentsMap: Record<string, CommentData> = {}
  for (const row of data || []) {
    if (row.repo_card_id) {
      commentsMap[row.repo_card_id] = {
        comment: row.comment || '',
        color: (row.comment_color as CommentColor) || DEFAULT_COMMENT_COLOR,
      }
    }
  }

  // Fill missing cards with empty comment data
  for (const cardId of repoCardIds) {
    if (!(cardId in commentsMap)) {
      commentsMap[cardId] = emptyComment
    }
  }

  return commentsMap
}

/**
 * Update comment for a single repo card
 *
 * Upserts the comment field in projectinfo table.
 * Used for inline editing on RepoCard.
 *
 * @param repoCardId - The repo card ID
 * @param comment - The new comment text (max 2000 chars)
 * @param color - Optional color for the comment (defaults to 'primary' on new)
 * @throws Error if comment exceeds character limit or color is invalid
 *
 * @example
 * await updateComment('card-1', 'Updated comment text')
 * await updateComment('card-1', 'With color', 'blue')
 */
export async function updateComment(
  repoCardId: string,
  comment: string,
  color?: CommentColor,
): Promise<void> {
  const supabase = await createClient()

  // Validate
  validateComment(comment)
  if (color) {
    validateCommentColor(color)
  }

  // Check if projectinfo exists
  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (existingInfo) {
    // Update existing
    const updateData: ProjectInfoUpdate = {
      comment,
      updated_at: new Date().toISOString(),
    }
    // Only update color if provided
    if (color) {
      updateData.comment_color = color
    }

    const { error } = await supabase
      .from('projectinfo')
      .update(updateData)
      .eq('id', existingInfo.id)

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update comment', repoCardId },
      })
      throw new Error('Failed to update comment')
    }
  } else {
    // Create new projectinfo with just the comment
    const { error } = await supabase.from('projectinfo').insert({
      repo_card_id: repoCardId,
      comment,
      comment_color: color || DEFAULT_COMMENT_COLOR,
      note: '',
      links: [],
    })

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Create comment', repoCardId },
      })
      throw new Error('Failed to save comment')
    }
  }

  // Note: No revalidatePath needed - client handles state via Redux
}

/**
 * Update comment color for a single repo card
 *
 * Updates only the color field, preserving the existing comment text.
 * Used when user selects a new color from the CommentActionsMenu.
 *
 * @param repoCardId - The repo card ID
 * @param color - The new color to set
 * @throws Error if color is invalid
 *
 * @example
 * await updateCommentColor('card-1', 'blue')
 */
export async function updateCommentColor(
  repoCardId: string,
  color: CommentColor,
): Promise<void> {
  const supabase = await createClient()

  // Validate
  validateCommentColor(color)

  // Check if projectinfo exists
  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (existingInfo) {
    // Update existing
    const { error } = await supabase
      .from('projectinfo')
      .update({
        comment_color: color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingInfo.id)

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update comment color', repoCardId, color },
      })
      throw new Error('Failed to update comment color')
    }
  } else {
    // Create new projectinfo with just the color (no comment text)
    const { error } = await supabase.from('projectinfo').insert({
      repo_card_id: repoCardId,
      comment: null,
      comment_color: color,
      note: '',
      links: [],
    })

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Create projectinfo for color', repoCardId, color },
      })
      throw new Error('Failed to save comment color')
    }
  }

  // Note: No revalidatePath needed - client handles state via Redux
}

/**
 * Delete comment for a single repo card
 *
 * Clears the comment text and resets color to default.
 * Does NOT delete the projectinfo row (preserves note, links).
 *
 * @param repoCardId - The repo card ID
 *
 * @example
 * await deleteComment('card-1')
 */
export async function deleteComment(repoCardId: string): Promise<void> {
  const supabase = await createClient()

  // Check if projectinfo exists
  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (!existingInfo) {
    // Nothing to delete
    return
  }

  // Clear comment and reset color to default
  const { error } = await supabase
    .from('projectinfo')
    .update({
      comment: null,
      comment_color: DEFAULT_COMMENT_COLOR,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingInfo.id)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Delete comment', repoCardId },
    })
    throw new Error('Failed to delete comment')
  }

  // Note: No revalidatePath needed - client handles state via Redux
}

/**
 * Delete project info
 */
export async function deleteProjectInfo(repoCardId: string): Promise<void> {
  const supabase = await createClient()

  const { data: projectInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (!projectInfo) {
    return // Do nothing if data doesn't exist
  }

  const { error } = await supabase
    .from('projectinfo')
    .delete()
    .eq('id', projectInfo.id)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Delete project info', repoCardId },
    })
    throw new Error('Failed to delete project information')
  }

  // Note: No revalidatePath needed - client handles state via Redux
}

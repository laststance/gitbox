/**
 * Project Info Core Logic
 *
 * Internal module containing the types, validation, and core functions for
 * project info operations. Every function takes the id of the RepoCard that
 * owns the project info and reads or writes `projectinfo.repo_card_id`.
 *
 * NOT a 'use server' module — imported by `project-info.ts`, which is.
 *
 * @see project-info.ts for the server action wrappers
 */

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

// ========================================
// Types
// ========================================

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
 * Data shape for project info operations
 */
export interface ProjectInfoData {
  note: string
  comment?: string
  links: ProjectLink[]
}

/**
 * Comment data returned by batch comment fetches
 */
export interface CommentData {
  comment: string
  color: CommentColor
}

// ========================================
// Validation
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

// ========================================
// Utility
// ========================================

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
export function normalizeLinks(links: unknown): ProjectLink[] {
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

// ========================================
// Core Functions
// ========================================

/**
 * Get project info for a RepoCard
 *
 * @param repoCardId - The RepoCard ID to look up
 * @returns ProjectInfoData or empty state if not found
 *
 * @example
 * const info = await getProjectInfoCore('card-uuid-123')
 */
export async function getProjectInfoCore(
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
      return { note: '', comment: '', links: [] }
    }
    throw new Error('Failed to fetch project information')
  }

  return {
    note: projectInfo.note || '',
    comment: projectInfo.comment || '',
    links: normalizeLinks(projectInfo.links),
  }
}

/**
 * Create or update project info for a RepoCard
 *
 * @param repoCardId - The RepoCard ID
 * @param data - ProjectInfoData to save
 *
 * @example
 * await upsertProjectInfoCore('card-uuid-123', {
 *   note: 'content',
 *   comment: 'text',
 *   links: [],
 * })
 */
export async function upsertProjectInfoCore(
  repoCardId: string,
  data: ProjectInfoData,
): Promise<void> {
  const supabase = await createClient()

  // Validation
  validateNote(data.note)
  if (data.comment !== undefined) {
    validateComment(data.comment)
  }
  data.links.forEach((link) => {
    if (link.url) {
      validateUrl(link.url)
    }
  })

  const linksArray = data.links
    .filter((link) => link.url && link.url.trim() !== '')
    .map((link) => ({ type: link.type, url: link.url }))

  const upsertData: ProjectInfoInsert = {
    repo_card_id: repoCardId,
    note: data.note,
    ...(data.comment !== undefined && { comment: data.comment }),
    links: linksArray,
  }

  const { error } = await supabase
    .from('projectinfo')
    .upsert(upsertData, { onConflict: 'repo_card_id' })

  if (error) {
    throw new Error('Failed to save project information')
  }
}

/**
 * Update comment for a single RepoCard
 *
 * @param repoCardId - The RepoCard ID
 * @param comment - New comment text (max 2000 chars)
 * @param color - Optional color for the comment
 *
 * @example
 * await updateCommentCore('card-1', 'Updated comment text', 'blue')
 */
export async function updateCommentCore(
  repoCardId: string,
  comment: string,
  color?: CommentColor,
): Promise<void> {
  const supabase = await createClient()

  validateComment(comment)
  if (color) {
    validateCommentColor(color)
  }

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (existingInfo) {
    const updateData: ProjectInfoUpdate = {
      comment,
    }
    if (color) {
      updateData.comment_color = color
    }

    const { error } = await supabase
      .from('projectinfo')
      .update(updateData)
      .eq('id', existingInfo.id)

    if (error) {
      throw new Error('Failed to update comment')
    }
  } else {
    const { error } = await supabase.from('projectinfo').insert({
      repo_card_id: repoCardId,
      comment,
      comment_color: color || DEFAULT_COMMENT_COLOR,
      note: '',
      links: [],
    })

    if (error) {
      throw new Error('Failed to save comment')
    }
  }
}

/**
 * Update comment color for a single RepoCard
 *
 * @param repoCardId - The RepoCard ID
 * @param color - New color to set
 *
 * @example
 * await updateCommentColorCore('card-1', 'blue')
 */
export async function updateCommentColorCore(
  repoCardId: string,
  color: CommentColor,
): Promise<void> {
  const supabase = await createClient()

  validateCommentColor(color)

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (existingInfo) {
    const { error } = await supabase
      .from('projectinfo')
      .update({
        comment_color: color,
      })
      .eq('id', existingInfo.id)

    if (error) {
      throw new Error('Failed to update comment color')
    }
  } else {
    const { error } = await supabase.from('projectinfo').insert({
      repo_card_id: repoCardId,
      comment: null,
      comment_color: color,
      note: '',
      links: [],
    })

    if (error) {
      throw new Error('Failed to save comment color')
    }
  }
}

/**
 * Delete comment for a single RepoCard
 *
 * Clears the comment text and resets color to default.
 * Does NOT delete the projectinfo row (preserves note, links).
 *
 * @param repoCardId - The RepoCard ID
 *
 * @example
 * await deleteCommentCore('card-1')
 */
export async function deleteCommentCore(repoCardId: string): Promise<void> {
  const supabase = await createClient()

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('repo_card_id', repoCardId)
    .single<{ id: string }>()

  if (!existingInfo) {
    return
  }

  const { error } = await supabase
    .from('projectinfo')
    .update({
      comment: null,
      comment_color: DEFAULT_COMMENT_COLOR,
    })
    .eq('id', existingInfo.id)

  if (error) {
    throw new Error('Failed to delete comment')
  }
}

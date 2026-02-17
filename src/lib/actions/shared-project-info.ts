/**
 * Shared Project Info Core Logic
 *
 * Internal module containing all shared types, validation, and core functions
 * for project info operations. Parameterized by FkConfig to support both
 * RepoCard-linked and Maintenance-linked project info.
 *
 * NOT a 'use server' module — imported by thin wrapper files that are.
 *
 * @see project-info.ts for RepoCard wrappers
 * @see maintenance-project-info.ts for Maintenance wrappers
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
 * Foreign key configuration for project info operations
 *
 * @param column - The FK column name in the projectinfo table
 * @param label - Human-readable label for Sentry error context
 *
 * @example
 * const repoCardFk: FkConfig = { column: 'repo_card_id', label: 'project info' }
 * const maintenanceFk: FkConfig = { column: 'maintenance_id', label: 'maintenance project info' }
 */
export type FkConfig = {
  column: 'repo_card_id' | 'maintenance_id'
  label: string
}

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
 * Get project info for an entity (RepoCard or Maintenance item)
 *
 * @param fk - Foreign key configuration
 * @param entityId - The entity ID to look up
 * @returns ProjectInfoData or empty state if not found
 *
 * @example
 * const info = await getProjectInfoCore(
 *   { column: 'repo_card_id', label: 'project info' },
 *   'card-uuid-123'
 * )
 */
export async function getProjectInfoCore(
  fk: FkConfig,
  entityId: string,
): Promise<ProjectInfoData | null> {
  const supabase = await createClient()

  const { data: projectInfo, error: infoError } = await supabase
    .from('projectinfo')
    .select('*')
    .eq(fk.column, entityId)
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
 * Create or update project info for an entity
 *
 * @param fk - Foreign key configuration
 * @param entityId - The entity ID
 * @param data - ProjectInfoData to save
 *
 * @example
 * await upsertProjectInfoCore(
 *   { column: 'maintenance_id', label: 'maintenance project info' },
 *   'maint-uuid-123',
 *   { note: 'content', comment: 'text', links: [] }
 * )
 */
export async function upsertProjectInfoCore(
  fk: FkConfig,
  entityId: string,
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

  const upsertData = {
    [fk.column]: entityId,
    note: data.note,
    ...(data.comment !== undefined && { comment: data.comment }),
    links: linksArray,
  } as ProjectInfoInsert

  const { error } = await supabase
    .from('projectinfo')
    .upsert(upsertData, { onConflict: fk.column })

  if (error) {
    throw new Error('Failed to save project information')
  }
}

/**
 * Get comments for multiple entities (batch fetch)
 *
 * @param fk - Foreign key configuration
 * @param entityIds - Array of entity IDs to fetch comments for
 * @returns Map of entity ID to CommentData
 *
 * @example
 * const comments = await getCommentsCore(
 *   { column: 'repo_card_id', label: 'project info' },
 *   ['card-1', 'card-2']
 * )
 */
export async function getCommentsCore(
  fk: FkConfig,
  entityIds: string[],
): Promise<Record<string, CommentData>> {
  if (entityIds.length === 0) {
    return {}
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projectinfo')
    .select(`${fk.column}, comment, comment_color`)
    .in(fk.column, entityIds)

  if (error) {
    throw new Error('Failed to fetch comments')
  }

  const commentsMap: Record<string, CommentData> = {}
  for (const row of data || []) {
    const id = row[fk.column as keyof typeof row] as string | null
    if (id) {
      commentsMap[id] = {
        comment: row.comment || '',
        color: (row.comment_color as CommentColor) || DEFAULT_COMMENT_COLOR,
      }
    }
  }

  for (const id of entityIds) {
    if (!(id in commentsMap)) {
      commentsMap[id] = { comment: '', color: DEFAULT_COMMENT_COLOR }
    }
  }

  return commentsMap
}

/**
 * Update comment for a single entity
 *
 * @param fk - Foreign key configuration
 * @param entityId - The entity ID
 * @param comment - New comment text (max 2000 chars)
 * @param color - Optional color for the comment
 *
 * @example
 * await updateCommentCore(
 *   { column: 'repo_card_id', label: 'project info' },
 *   'card-1',
 *   'Updated comment text',
 *   'blue'
 * )
 */
export async function updateCommentCore(
  fk: FkConfig,
  entityId: string,
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
    .eq(fk.column, entityId)
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
      [fk.column]: entityId,
      comment,
      comment_color: color || DEFAULT_COMMENT_COLOR,
      note: '',
      links: [],
    } as ProjectInfoInsert)

    if (error) {
      throw new Error('Failed to save comment')
    }
  }
}

/**
 * Update comment color for a single entity
 *
 * @param fk - Foreign key configuration
 * @param entityId - The entity ID
 * @param color - New color to set
 *
 * @example
 * await updateCommentColorCore(
 *   { column: 'maintenance_id', label: 'maintenance project info' },
 *   'maint-1',
 *   'blue'
 * )
 */
export async function updateCommentColorCore(
  fk: FkConfig,
  entityId: string,
  color: CommentColor,
): Promise<void> {
  const supabase = await createClient()

  validateCommentColor(color)

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq(fk.column, entityId)
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
      [fk.column]: entityId,
      comment: null,
      comment_color: color,
      note: '',
      links: [],
    } as ProjectInfoInsert)

    if (error) {
      throw new Error('Failed to save comment color')
    }
  }
}

/**
 * Delete comment for a single entity
 *
 * Clears the comment text and resets color to default.
 * Does NOT delete the projectinfo row (preserves note, links).
 *
 * @param fk - Foreign key configuration
 * @param entityId - The entity ID
 *
 * @example
 * await deleteCommentCore(
 *   { column: 'repo_card_id', label: 'project info' },
 *   'card-1'
 * )
 */
export async function deleteCommentCore(
  fk: FkConfig,
  entityId: string,
): Promise<void> {
  const supabase = await createClient()

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq(fk.column, entityId)
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

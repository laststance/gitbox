/**
 * Maintenance Project Info CRUD Operations
 *
 * Server Actions for managing ProjectInfo data linked to Maintenance records.
 * Mirrors the functionality of project-info.ts but for maintenance mode items.
 *
 * @see lib/actions/project-info.ts for RepoCard-linked ProjectInfo operations
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
 */
export interface ProjectLink {
  url: string
  type: string
}

export interface ProjectInfoData {
  note: string
  comment: string
  links: ProjectLink[]
}

/**
 * Comment data returned by getCommentsForMaintenanceItems
 */
export interface CommentData {
  comment: string
  color: CommentColor
}

// ========================================
// Validation Wrappers (reuse from project-info.ts patterns)
// ========================================

function validateNote(note: string): boolean {
  const result = noteSchema.safeParse(note)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid note')
  }
  return true
}

function validateComment(comment: string): boolean {
  const result = commentSchema.safeParse(comment)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid comment')
  }
  return true
}

function validateCommentColor(color: string): color is CommentColor {
  const result = commentColorSchema.safeParse(color)
  if (!result.success) {
    throw new Error(`Invalid comment color: ${color}`)
  }
  return true
}

function validateUrl(url: string): boolean {
  const result = projectLinkUrlSchema.safeParse(url)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid URL')
  }
  return true
}

/**
 * Normalize links from DB to array format
 */
function normalizeLinks(links: unknown): ProjectLink[] {
  if (!links) return []
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
  return []
}

// ========================================
// Main API Functions
// ========================================

/**
 * Get project info for a maintenance item
 *
 * @param maintenanceId - Maintenance record ID
 * @returns ProjectInfoData or null if not found
 *
 * @example
 * const info = await getMaintenanceProjectInfo('maint-uuid-123')
 * // Returns: { note: '...', comment: '...', links: [...] }
 */
export async function getMaintenanceProjectInfo(
  maintenanceId: string,
): Promise<ProjectInfoData | null> {
  const supabase = await createClient()

  const { data: projectInfo, error: infoError } = await supabase
    .from('projectinfo')
    .select('*')
    .eq('maintenance_id', maintenanceId)
    .single<ProjectInfoRow>()

  if (infoError) {
    if (infoError.code === 'PGRST116') {
      return { note: '', comment: '', links: [] }
    }
    Sentry.captureException(infoError, {
      extra: { context: 'Fetch maintenance project info', maintenanceId },
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

  const linksArray = data.links
    .filter((link) => link.url && link.url.trim() !== '')
    .map((link) => ({ type: link.type, url: link.url }))

  try {
    const { data: existingInfo } = await supabase
      .from('projectinfo')
      .select('id')
      .eq('maintenance_id', maintenanceId)
      .single<{ id: string }>()

    if (existingInfo) {
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
          extra: { context: 'Update maintenance project info', maintenanceId },
        })
        throw new Error('Failed to update project information')
      }
    } else {
      const insertData: ProjectInfoInsert = {
        maintenance_id: maintenanceId,
        note: data.note,
        comment: data.comment,
        links: linksArray,
      }

      const { error: createError } = await supabase
        .from('projectinfo')
        .insert(insertData)

      if (createError) {
        Sentry.captureException(createError, {
          extra: { context: 'Create maintenance project info', maintenanceId },
        })
        throw new Error('Failed to create project information')
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('An error occurred while saving project information')
  }
}

/**
 * Get comments for multiple maintenance items (batch fetch)
 *
 * Efficiently fetches comment and color fields for multiple items in a single query.
 * Used when loading the maintenance list to display inline comments.
 *
 * @param maintenanceIds - Array of maintenance IDs to fetch comments for
 * @returns Map of maintenance ID to CommentData
 *
 * @example
 * const comments = await getCommentsForMaintenanceItems(['maint-1', 'maint-2'])
 * // Returns: { 'maint-1': { comment: 'Some comment', color: 'primary' }, ... }
 */
export async function getCommentsForMaintenanceItems(
  maintenanceIds: string[],
): Promise<Record<string, CommentData>> {
  const emptyComment: CommentData = {
    comment: '',
    color: DEFAULT_COMMENT_COLOR,
  }

  if (maintenanceIds.length === 0) {
    return {}
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projectinfo')
    .select('maintenance_id, comment, comment_color')
    .in('maintenance_id', maintenanceIds)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Batch fetch maintenance comments', maintenanceIds },
    })
    return {}
  }

  const commentsMap: Record<string, CommentData> = {}
  for (const row of data || []) {
    if (row.maintenance_id) {
      commentsMap[row.maintenance_id] = {
        comment: row.comment || '',
        color: (row.comment_color as CommentColor) || DEFAULT_COMMENT_COLOR,
      }
    }
  }

  for (const id of maintenanceIds) {
    if (!(id in commentsMap)) {
      commentsMap[id] = emptyComment
    }
  }

  return commentsMap
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
): Promise<void> {
  const supabase = await createClient()

  validateComment(comment)
  if (color) {
    validateCommentColor(color)
  }

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('maintenance_id', maintenanceId)
    .single<{ id: string }>()

  if (existingInfo) {
    const updateData: ProjectInfoUpdate = {
      comment,
      updated_at: new Date().toISOString(),
    }
    if (color) {
      updateData.comment_color = color
    }

    const { error } = await supabase
      .from('projectinfo')
      .update(updateData)
      .eq('id', existingInfo.id)

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update maintenance comment', maintenanceId },
      })
      throw new Error('Failed to update comment')
    }
  } else {
    const { error } = await supabase.from('projectinfo').insert({
      maintenance_id: maintenanceId,
      comment,
      comment_color: color || DEFAULT_COMMENT_COLOR,
      note: '',
      links: [],
    })

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Create maintenance comment', maintenanceId },
      })
      throw new Error('Failed to save comment')
    }
  }
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
): Promise<void> {
  const supabase = await createClient()

  validateCommentColor(color)

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('maintenance_id', maintenanceId)
    .single<{ id: string }>()

  if (existingInfo) {
    const { error } = await supabase
      .from('projectinfo')
      .update({
        comment_color: color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingInfo.id)

    if (error) {
      Sentry.captureException(error, {
        extra: {
          context: 'Update maintenance comment color',
          maintenanceId,
          color,
        },
      })
      throw new Error('Failed to update comment color')
    }
  } else {
    const { error } = await supabase.from('projectinfo').insert({
      maintenance_id: maintenanceId,
      comment: null,
      comment_color: color,
      note: '',
      links: [],
    })

    if (error) {
      Sentry.captureException(error, {
        extra: {
          context: 'Create maintenance projectinfo for color',
          maintenanceId,
          color,
        },
      })
      throw new Error('Failed to save comment color')
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
 *
 * @example
 * await deleteMaintenanceComment('maint-1')
 */
export async function deleteMaintenanceComment(
  maintenanceId: string,
): Promise<void> {
  const supabase = await createClient()

  const { data: existingInfo } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('maintenance_id', maintenanceId)
    .single<{ id: string }>()

  if (!existingInfo) {
    return
  }

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
      extra: { context: 'Delete maintenance comment', maintenanceId },
    })
    throw new Error('Failed to delete comment')
  }
}

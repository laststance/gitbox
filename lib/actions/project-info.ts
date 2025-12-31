/**
 * Project Info CRUD Operations
 *
 * Constitution requirements:
 * - Principle V: Security first (input validation, XSS prevention)
 *
 * User Story 4:
 * - Quick note: 1-3 line memo (300 character limit)
 * - Links: Production URL, Tracking services, Supabase Dashboard
 * - Supabase integration for persistent storage
 */

'use server'

import * as Sentry from '@sentry/nextjs'

import { createClient } from '@/lib/supabase/server'
import type { TablesInsert, Tables, TablesUpdate } from '@/lib/supabase/types'
import { getSlateTextLength, parseSlateValue } from '@/lib/utils/slate-utils'

type ProjectInfoRow = Tables<'projectinfo'>
type ProjectInfoInsert = TablesInsert<'projectinfo'>
type ProjectInfoUpdate = TablesUpdate<'projectinfo'>

export interface ProjectLink {
  url: string
  type: 'production' | 'tracking' | 'supabase'
}

export interface ProjectInfoData {
  note: string
  comment: string
  links: ProjectLink[]
}

/** Maximum character limit for notes (rich text) */
const NOTE_MAX_LENGTH = 20000

/** Maximum character limit for comments (inline, Card-in-Card) */
const COMMENT_MAX_LENGTH = 2000

/**
 * Validate note content (rich text)
 *
 * Note: note is stored as JSON (Slate format).
 * We validate the actual text length, not the JSON string length.
 *
 * @param note - The note content to validate (JSON string)
 * @returns true if valid
 * @throws Error if text content exceeds character limit
 */
function validateNote(note: string): boolean {
  try {
    // Parse JSON to get actual text length
    const slateValue = parseSlateValue(note)
    const textLength = getSlateTextLength(slateValue)

    if (textLength > NOTE_MAX_LENGTH) {
      throw new Error(`Note must be ${NOTE_MAX_LENGTH} characters or less`)
    }
  } catch {
    // If parsing fails, fall back to raw length check
    // This handles legacy plain text notes
    if (note.length > NOTE_MAX_LENGTH) {
      throw new Error(`Note must be ${NOTE_MAX_LENGTH} characters or less`)
    }
  }
  return true
}

/**
 * Validate comment content (inline, Card-in-Card)
 *
 * @param comment - The comment content to validate (plain text)
 * @returns true if valid
 * @throws Error if content exceeds character limit
 */
function validateComment(comment: string): boolean {
  if (comment.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Comment must be ${COMMENT_MAX_LENGTH} characters or less`)
  }
  return true
}

/**
 * Validate URL
 */
function validateUrl(url: string): boolean {
  if (!url) return true // Allow empty URLs (will be filtered out)

  const urlRegex = /^https?:\/\/.+/
  if (!urlRegex.test(url)) {
    throw new Error('URL must start with http:// or https://')
  }

  try {
    new URL(url)
    return true
  } catch {
    throw new Error('Invalid URL format')
  }
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

  // Convert links from Json to array
  type LinksJson = {
    production?: string[]
    tracking?: string[]
    supabase?: string[]
  }
  const linksData = (projectInfo.links as LinksJson | null) || {
    production: [],
    tracking: [],
    supabase: [],
  }
  const linksArray: ProjectInfoData['links'] = [
    ...(linksData.production || []).map((url: string) => ({
      url,
      type: 'production' as const,
    })),
    ...(linksData.tracking || []).map((url: string) => ({
      url,
      type: 'tracking' as const,
    })),
    ...(linksData.supabase || []).map((url: string) => ({
      url,
      type: 'supabase' as const,
    })),
  ]

  return {
    note: projectInfo.note || '',
    comment: projectInfo.comment || '',
    links: linksArray,
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

  // Convert links to match type
  const linksJson = {
    production: data.links
      .filter((l) => l.type === 'production')
      .map((l) => l.url),
    tracking: data.links.filter((l) => l.type === 'tracking').map((l) => l.url),
    supabase: data.links.filter((l) => l.type === 'supabase').map((l) => l.url),
  }

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
        links: linksJson,
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
        links: linksJson,
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
 * Efficiently fetches comment field for multiple cards in a single query.
 * Used when loading a board to display inline comments on RepoCards.
 *
 * @param repoCardIds - Array of repo card IDs to fetch comments for
 * @returns Map of repo card ID to comment string
 *
 * @example
 * const comments = await getCommentsForCards(['card-1', 'card-2'])
 * // Returns: { 'card-1': 'Some comment', 'card-2': '' }
 */
export async function getCommentsForCards(
  repoCardIds: string[],
): Promise<Record<string, string>> {
  if (repoCardIds.length === 0) {
    return {}
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projectinfo')
    .select('repo_card_id, comment')
    .in('repo_card_id', repoCardIds)

  if (error) {
    Sentry.captureException(error, {
      extra: { context: 'Batch fetch comments', repoCardIds },
    })
    // Return empty map on error (non-critical)
    return {}
  }

  // Convert to map
  const commentsMap: Record<string, string> = {}
  for (const row of data || []) {
    commentsMap[row.repo_card_id] = row.comment || ''
  }

  // Fill missing cards with empty string
  for (const cardId of repoCardIds) {
    if (!(cardId in commentsMap)) {
      commentsMap[cardId] = ''
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
 * @throws Error if comment exceeds character limit
 *
 * @example
 * await updateComment('card-1', 'Updated comment text')
 */
export async function updateComment(
  repoCardId: string,
  comment: string,
): Promise<void> {
  const supabase = await createClient()

  // Validate
  validateComment(comment)

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
        comment,
        updated_at: new Date().toISOString(),
      })
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
      note: '',
      links: { production: [], tracking: [], supabase: [] },
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

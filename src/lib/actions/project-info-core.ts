/**
 * Project Info Core Logic
 *
 * Internal module containing the types, validation, and core functions for
 * project info operations. The note, links and comment belong to the user and
 * the repository, not to the card (issue #216): a `projectinfo` row is keyed
 * by `user_id` and `repo_key` (lowercase `owner/name`) and outlives the card.
 * Every function still takes the id of the RepoCard the browser has, reads
 * the repository that card holds and works on that repository's row.
 *
 * NOT a 'use server' module — imported by `project-info.ts`, which is.
 *
 * @see project-info.ts for the server action wrappers
 */

import { createClient } from '@/lib/supabase/server'
import type { TablesInsert, CommentColor } from '@/lib/supabase/types'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'
import {
  noteSchema,
  commentSchema,
  commentColorSchema,
  projectLinkUrlSchema,
  DEFAULT_COMMENT_COLOR,
} from '@/lib/validations/project-info'

type ProjectInfoInsert = TablesInsert<'projectinfo'>

/**
 * Column PostgREST upserts a memory on: one row per user and repository.
 * `user_id` is filled by its default (`auth.uid()`), `repo_key` by the
 * database from `repo_owner` and `repo_name`.
 */
const PROJECT_INFO_CONFLICT_TARGET = 'user_id,repo_key'

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

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Read the repository a card holds, as the signed-in user.
 *
 * Row level security returns the user's own cards only, so a card of someone
 * else reads as missing. Called before every write: the write is keyed by the
 * repository, and the database accepts it only while the user has a card for
 * that repository.
 *
 * @param supabase - Server client of the signed-in user.
 * @param repoCardId - The RepoCard ID the browser sent.
 * @returns The card's `repo_owner` and `repo_name`.
 * @throws When the card does not exist or belongs to someone else.
 * @example
 * await readCardRepository(supabase, 'card-1') // => { repo_owner: 'laststance', repo_name: 'gitbox' }
 */
async function readCardRepository(
  supabase: ServerSupabaseClient,
  repoCardId: string,
): Promise<Pick<ProjectInfoInsert, 'repo_owner' | 'repo_name'>> {
  const { data: card, error } = await supabase
    .from('repocard')
    .select('repo_owner, repo_name')
    .eq('id', repoCardId)
    .single()

  if (error || !card) {
    throw new Error('Card not found')
  }

  return { repo_owner: card.repo_owner, repo_name: card.repo_name }
}

/**
 * Get the project info of the repository a RepoCard holds.
 *
 * One request: the card embeds its repository's row through the computed
 * relationship `projectinfo(repocard)`, an object or `null`.
 *
 * @param repoCardId - The RepoCard ID to look up
 * @returns
 * - The note, comment and links of the repository
 * - Empty values when nothing is saved for it, or when the card is not found
 * @throws When the request fails for another reason
 *
 * @example
 * const info = await getProjectInfoCore('card-uuid-123')
 */
export async function getProjectInfoCore(
  repoCardId: string,
): Promise<ProjectInfoData | null> {
  const supabase = await createClient()

  const { data: card, error } = await supabase
    .from('repocard')
    .select('projectinfo(note, comment, links)')
    .eq('id', repoCardId)
    .single()

  if (error) {
    // No card (or not the user's): there is nothing to show
    if (error.code === 'PGRST116') {
      return { note: '', comment: '', links: [] }
    }
    throw new Error('Failed to fetch project information')
  }

  const projectInfo = card.projectinfo

  return {
    note: projectInfo?.note || '',
    comment: projectInfo?.comment || '',
    links: normalizeLinks(projectInfo?.links),
  }
}

/**
 * Create or update the project info of the repository a RepoCard holds.
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

  const repository = await readCardRepository(supabase, repoCardId)

  const upsertData: ProjectInfoInsert = {
    ...repository,
    note: data.note,
    ...(data.comment !== undefined && { comment: data.comment }),
    links: linksArray,
  }

  const { error } = await supabase
    .from('projectinfo')
    .upsert(upsertData, { onConflict: PROJECT_INFO_CONFLICT_TARGET })

  if (error) {
    throw new Error('Failed to save project information')
  }
}

/**
 * Update the comment of the repository a RepoCard holds.
 *
 * One upsert: it creates the row when nothing is saved yet and otherwise
 * changes the comment (and the color, when given) and leaves the note and the
 * links alone.
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

  const repository = await readCardRepository(supabase, repoCardId)

  const { error } = await supabase.from('projectinfo').upsert(
    {
      ...repository,
      comment,
      // Without a color a new row takes the column default (primary)
      ...(color && { comment_color: color }),
    },
    { onConflict: PROJECT_INFO_CONFLICT_TARGET },
  )

  if (error) {
    throw new Error('Failed to update comment')
  }
}

/**
 * Update the comment color of the repository a RepoCard holds.
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

  const repository = await readCardRepository(supabase, repoCardId)

  const { error } = await supabase
    .from('projectinfo')
    .upsert(
      { ...repository, comment_color: color },
      { onConflict: PROJECT_INFO_CONFLICT_TARGET },
    )

  if (error) {
    throw new Error('Failed to update comment color')
  }
}

/**
 * Delete the comment of the repository a RepoCard holds.
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

  const repository = await readCardRepository(supabase, repoCardId)

  // Row level security limits the update to the user's own row; a repository
  // with nothing saved matches no row and nothing changes
  const { error } = await supabase
    .from('projectinfo')
    .update({
      comment: null,
      comment_color: DEFAULT_COMMENT_COLOR,
    })
    .eq(
      'repo_key',
      toRepoIdentifier(repository.repo_owner, repository.repo_name),
    )

  if (error) {
    throw new Error('Failed to delete comment')
  }
}

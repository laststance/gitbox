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

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import type { Database, TablesInsert, CommentColor } from '@/lib/supabase/types'
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

/** The repository a card holds, and whose memory a write may touch. */
interface CardRepository {
  /** The card's `repo_owner` and `repo_name`, as a `projectinfo` row names them. */
  repository: Pick<ProjectInfoInsert, 'repo_owner' | 'repo_name'>
  /** The owner of the card's board: the user whose row a write touches. */
  ownerId: string
}

/**
 * Read the repository a card holds, and its owner, as the signed-in user.
 *
 * Row level security returns the user's own cards and boards only, so a card
 * of someone else reads as missing. Called before every write: the write is
 * keyed by the repository, and the database accepts it only while the user has
 * a card for that repository. The owner comes from the board join, the way
 * app code reads ownership.
 *
 * @param supabase - Server client of the signed-in user.
 * @param repoCardId - The RepoCard ID the browser sent.
 * @returns The card's repository and the id of the user who owns it.
 * @throws "Card not found" when the card does not exist or belongs to someone
 *   else; "Failed to read the card" when the read itself failed.
 * @example
 * await readCardRepository(supabase, 'card-1')
 * // => { repository: { repo_owner: 'laststance', repo_name: 'gitbox' }, ownerId: 'user-1' }
 */
async function readCardRepository(
  supabase: SupabaseClient<Database>,
  repoCardId: string,
): Promise<CardRepository> {
  const { data: card, error } = await supabase
    .from('repocard')
    .select('repo_owner, repo_name, board!inner(user_id)')
    .eq('id', repoCardId)
    .single()

  // PGRST116: no row, so the card is gone or not the user's
  if (error?.code === 'PGRST116') {
    throw new Error('Card not found')
  }
  if (error) {
    throw new Error('Failed to read the card')
  }

  return {
    repository: { repo_owner: card.repo_owner, repo_name: card.repo_name },
    ownerId: card.board.user_id,
  }
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
 * - Empty values when nothing is saved for it
 * @throws "Card not found" when the card is gone or not the user's: the
 *   repository's note may still exist, so the Note dialog must not open an
 *   empty editor over it; "Failed to fetch project information" otherwise
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
    // PGRST116: no card (or not the user's). Its repository's note outlives
    // it, so this is no empty note
    if (error.code === 'PGRST116') {
      throw new Error('Card not found')
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
 * @throws The validation message when the note, comment or a URL is invalid;
 *   "Card not found" or "Failed to read the card" from the card read;
 *   "Failed to save project information" when the database refused the write.
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

  const { repository } = await readCardRepository(supabase, repoCardId)

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
 * @throws The validation message when the comment or color is invalid;
 *   "Card not found" or "Failed to read the card" from the card read;
 *   "Failed to update comment" when the database refused the write.
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

  const { repository } = await readCardRepository(supabase, repoCardId)

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
 * @throws The validation message when the color is invalid; "Card not found"
 *   or "Failed to read the card" from the card read; "Failed to update comment
 *   color" when the database refused the write.
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

  const { repository } = await readCardRepository(supabase, repoCardId)

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
 * @throws "Card not found" or "Failed to read the card" from the card read;
 *   "Failed to delete comment" when the database refused the write.
 *
 * @example
 * await deleteCommentCore('card-1')
 */
export async function deleteCommentCore(repoCardId: string): Promise<void> {
  const supabase = await createClient()

  const { repository, ownerId } = await readCardRepository(supabase, repoCardId)

  // The key is the same for every user holding the repository: the owner
  // filter keeps the update to this user's row whatever row level security
  // does. A repository with nothing saved matches no row and nothing changes
  const { error } = await supabase
    .from('projectinfo')
    .update({
      comment: null,
      comment_color: DEFAULT_COMMENT_COLOR,
    })
    .eq('user_id', ownerId)
    .eq(
      'repo_key',
      toRepoIdentifier(repository.repo_owner, repository.repo_name),
    )

  if (error) {
    throw new Error('Failed to delete comment')
  }
}

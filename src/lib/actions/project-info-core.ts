/**
 * Project Info Core Logic
 *
 * Internal module containing the types, validation, and core functions for
 * project info operations. The note, links and comment belong to the user and
 * the repository, not to the card (issue #216): a `projectinfo` row outlives
 * the card. A confirmed GitHub id is its identity; until then the row is keyed
 * by `user_id` and `repo_key` (lowercase `owner/name`).
 * Every function still takes the id of the RepoCard the browser has, reads
 * the repository that card holds and works on that repository's row.
 *
 * NOT a 'use server' module — imported by `project-info.ts`, which is.
 *
 * @see project-info.ts for the server action wrappers
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import { BOARD_OF_CARD_RELATION } from '@/lib/constants/board-bundle'
import { lookupRepositoryByGitHubId } from '@/lib/github/verify-repository-identity'
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

import { ActionUserError, type ActionErrorCode } from './types'

type ProjectInfoInsert = TablesInsert<'projectinfo'>

/**
 * Column PostgREST upserts a memory on when no row has the GitHub id yet.
 * `user_id` is filled by its default (`auth.uid()`), `repo_key` by the
 * database from `repo_owner` and `repo_name`.
 */
const PROJECT_INFO_CONFLICT_TARGET = 'user_id,repo_key'

/**
 * The memory that already carries this repository's confirmed GitHub id.
 *
 * A rename changes `owner/name`, so that row is no longer found by
 * `repo_key`. Called before a write so the note stays on the row instead of
 * inserting a second one the partial unique index rejects.
 *
 * @param supabase - Server client of the signed-in user.
 * @param ownerId - The user whose memory the write may touch.
 * @param githubRepoId - The id GitHub confirmed for the card.
 * @returns The memory id, or `null` when this id has no row yet. `error` is
 *   set when the read itself failed; the caller must not insert past it.
 * @example
 * await findMemoryIdByGitHubRepoId(supabase, 'user-1', 42)
 * // => { id: 'memory-1', error: null }
 */
async function findMemoryIdByGitHubRepoId(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  githubRepoId: number,
): Promise<{ id: string | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from('projectinfo')
    .select('id')
    .eq('user_id', ownerId)
    .eq('github_repo_id', githubRepoId)
    .maybeSingle()

  if (error) return { id: null, error }
  return { id: data?.id ?? null, error: null }
}

/**
 * The memory stored under this owner/name, whatever GitHub id it carries.
 *
 * Called when no memory has the card's id yet, before an upsert on
 * `repo_key`. A row with a different confirmed id is another repository
 * that used to have this name, and must not be overwritten.
 *
 * @param supabase - Server client of the signed-in user.
 * @param ownerId - The user whose memory the write may touch.
 * @param repository - The card's owner and name.
 * @returns The id on that row, whether a row exists, and a read error.
 * @example
 * await findMemoryByRepoKey(supabase, 'user-1', repository)
 * // => { githubRepoId: null, found: false, error: null }
 */
async function findMemoryByRepoKey(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  repository: Pick<ProjectInfoInsert, 'repo_owner' | 'repo_name'>,
): Promise<{
  githubRepoId: number | null
  found: boolean
  error: { message: string } | null
}> {
  const { data, error } = await supabase
    .from('projectinfo')
    .select('github_repo_id')
    .eq('user_id', ownerId)
    .eq(
      'repo_key',
      toRepoIdentifier(repository.repo_owner, repository.repo_name),
    )
    .maybeSingle()

  if (error) return { githubRepoId: null, found: false, error }
  if (!data) return { githubRepoId: null, found: false, error: null }
  return {
    githubRepoId:
      typeof data.github_repo_id === 'number' ? data.github_repo_id : null,
    found: true,
    error: null,
  }
}

/**
 * Whether this name's memory is a different repository's.
 *
 * @param githubRepoId - The id on the row, when it has one.
 * @param cardGitHubRepoId - The id GitHub confirmed for the card.
 * @returns `true` when writing here would attach another repository's note.
 * @example
 * memoryBelongsToAnotherRepository(99, 42) // => true
 */
function memoryBelongsToAnotherRepository(
  githubRepoId: number | null,
  cardGitHubRepoId: number,
): boolean {
  return githubRepoId !== null && githubRepoId !== cardGitHubRepoId
}

/**
 * Moves a memory off a name when no card still holds its GitHub id.
 *
 * The note outlives the card. After the card is deleted the memory keeps the
 * old name, and a new repository that takes that name cannot save. Called by
 * {@link writeRepositoryMemory} before it would refuse the save. A card that
 * still has the id keeps the memory where it is.
 *
 * @param supabase - Server client of the signed-in user.
 * @param ownerId - The user whose memory the write may touch.
 * @param githubRepoId - The id on the memory that currently has this name.
 * @param repository - The name the new repository needs.
 * @returns `moved` when the name is free. `moved: false` when a card still
 *   holds the id, or GitHub still gives that id this name.
 * @example
 * await relocateOrphanMemory(supabase, 'user-1', 99, repository)
 */
async function relocateOrphanMemory(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  githubRepoId: number,
  repository: Pick<ProjectInfoInsert, 'repo_owner' | 'repo_name'>,
): Promise<{ moved: boolean; error: { message: string } | null }> {
  const { data: heldByCard, error: heldError } = await supabase
    .from('repocard')
    .select('id')
    .eq('github_repo_id', githubRepoId)
    .limit(1)
    .maybeSingle()
  if (heldError) return { moved: false, error: heldError }
  if (heldByCard) return { moved: false, error: null }

  const current = await lookupRepositoryByGitHubId(githubRepoId)
  if (current.outcome !== 'confirmed') {
    return {
      moved: false,
      error: { message: 'Could not confirm the repository with GitHub' },
    }
  }
  const currentIdentifier = toRepoIdentifier(
    current.repository.owner,
    current.repository.name,
  )
  if (
    currentIdentifier ===
    toRepoIdentifier(repository.repo_owner, repository.repo_name)
  ) {
    return { moved: false, error: null }
  }

  const { error } = await supabase
    .from('projectinfo')
    .update({
      repo_owner: current.repository.owner,
      repo_name: current.repository.name,
    })
    .eq('user_id', ownerId)
    .eq('github_repo_id', githubRepoId)
  if (error) return { moved: false, error }
  return { moved: true, error: null }
}

/**
 * Create or update the memory of the repository a card holds.
 *
 * When the card has a confirmed id and a memory already has it, that row is
 * updated and its owner/name move with the card. The `user_id,repo_key`
 * upsert runs only when no memory has the id, which is a first save or a
 * card whose id is not confirmed yet.
 *
 * @param supabase - Server client of the signed-in user.
 * @param ownerId - The user whose memory the write may touch.
 * @param repository - The card's owner, name and confirmed id.
 * @param fields - The note, comment or color this save changes.
 * @returns The database error, or `null` when the write was accepted.
 * @example
 * await writeRepositoryMemory(supabase, 'user-1', repository, { note: 'a' })
 */
async function writeRepositoryMemory(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  repository: CardRepository['repository'],
  fields: Omit<
    ProjectInfoInsert,
    'repo_owner' | 'repo_name' | 'github_repo_id'
  >,
): Promise<{ error: { message: string } | null }> {
  const githubRepoId = repository.github_repo_id
  // A confirmed id is the row. Updating it by name would insert a duplicate.
  if (typeof githubRepoId === 'number') {
    const found = await findMemoryIdByGitHubRepoId(
      supabase,
      ownerId,
      githubRepoId,
    )
    if (found.error) return found
    if (found.id) {
      const { error } = await supabase
        .from('projectinfo')
        .update({
          repo_owner: repository.repo_owner,
          repo_name: repository.repo_name,
          github_repo_id: githubRepoId,
          ...fields,
        })
        .eq('id', found.id)
        .eq('user_id', ownerId)
      return { error }
    }

    // The name may still belong to a memory whose id is a different repository.
    // A card that holds that id keeps its memory. A memory whose card is gone
    // moves to the name GitHub gives that id, so this repository can have a row.
    const byName = await findMemoryByRepoKey(supabase, ownerId, repository)
    if (byName.error) return { error: byName.error }
    if (
      byName.githubRepoId !== null &&
      memoryBelongsToAnotherRepository(byName.githubRepoId, githubRepoId)
    ) {
      const relocated = await relocateOrphanMemory(
        supabase,
        ownerId,
        byName.githubRepoId,
        repository,
      )
      if (relocated.error) return relocated
      if (!relocated.moved) {
        return { error: { message: 'Memory belongs to another repository' } }
      }
    }
  }

  const { error } = await supabase
    .from('projectinfo')
    .upsert(
      { ...repository, ...fields },
      { onConflict: PROJECT_INFO_CONFLICT_TARGET },
    )
  return { error }
}

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

/**
 * Refuses a project-info read or write with a sentence the Note dialog or
 * the comment editor can show.
 *
 * {@link getProjectInfo} and the write actions run inside the auth guards,
 * which replace any other thrown message with a generic one. These sentences
 * are already safe: a missing card, a validation message, or a write the
 * database refused. The Note dialog puts a save's message in its toast, so
 * the sentence has to survive the guard. Called by the validators, by
 * {@link readCardRepository}, and by each write.
 *
 * @param message - What the user reads.
 * @param errorCode - Set when the client has to tell this refusal from the
 *   others. A missing card is `CARD_NOT_FOUND`: the Note dialog keeps the
 *   draft under the repository and does not say to open the same card.
 * @throws {@link ActionUserError} always.
 * @example
 * explainToUser('Card not found', 'CARD_NOT_FOUND')
 */
function explainToUser(message: string, errorCode?: ActionErrorCode): never {
  throw new ActionUserError(message, errorCode)
}

/**
 * Reports a project-info read or write the database refused, then refuses
 * it with the sentence the dialog shows.
 *
 * The auth guard does not report an {@link ActionUserError}, and it replaces
 * any other thrown error with one generic sentence. The PostgREST code
 * (42703 while a migration is deploying, 42501, 23514) would be lost.
 * Called when a project-info read or write gets an error that is not a
 * missing card: a note read, a note save, a comment save, a color change
 * or a comment delete.
 *
 * @param message - What the user reads.
 * @param error - The error PostgREST returned. `code` is sent to Sentry.
 * @throws {@link ActionUserError} always.
 * @example
 * reportDatabaseRefusal('Failed to save project information', error)
 */
function reportDatabaseRefusal(
  message: string,
  error: { message: string; code?: string },
): never {
  Sentry.captureException(new Error(message, { cause: error }), {
    extra: { code: error.code },
  })
  explainToUser(message)
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
    explainToUser(result.error.issues[0]?.message || 'Invalid note')
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
    explainToUser(result.error.issues[0]?.message || 'Invalid comment')
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
    explainToUser(`Invalid comment color: ${color}`)
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
    explainToUser(result.error.issues[0]?.message || 'Invalid URL')
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
  repository: Pick<
    ProjectInfoInsert,
    'repo_owner' | 'repo_name' | 'github_repo_id'
  >
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
    .select(
      `repo_owner, repo_name, github_repo_id, ${BOARD_OF_CARD_RELATION}!inner(user_id)`,
    )
    .eq('id', repoCardId)
    .single()

  // PGRST116: no row, so the card is gone or not the user's
  if (error?.code === 'PGRST116') {
    explainToUser('Card not found', 'CARD_NOT_FOUND')
  }
  if (error) {
    reportDatabaseRefusal('Failed to read the card', error)
  }

  return {
    repository: {
      repo_owner: card.repo_owner,
      repo_name: card.repo_name,
      // Omit an unconfirmed id so a later save does not wipe one that exists
      ...(typeof card.github_repo_id === 'number'
        ? { github_repo_id: card.github_repo_id }
        : {}),
    },
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
      explainToUser('Card not found', 'CARD_NOT_FOUND')
    }
    reportDatabaseRefusal('Failed to fetch project information', error)
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

  const { repository, ownerId } = await readCardRepository(supabase, repoCardId)

  const { error } = await writeRepositoryMemory(supabase, ownerId, repository, {
    note: data.note,
    ...(data.comment !== undefined && { comment: data.comment }),
    links: linksArray,
  })

  if (error) {
    reportDatabaseRefusal('Failed to save project information', error)
  }
}

/**
 * Update the comment of the repository a RepoCard holds.
 *
 * It creates the row when nothing is saved yet and otherwise changes the
 * comment (and the color, when given) and leaves the note and the links
 * alone. A row that already has the card's GitHub id is updated in place.
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

  const { repository, ownerId } = await readCardRepository(supabase, repoCardId)

  const { error } = await writeRepositoryMemory(supabase, ownerId, repository, {
    comment,
    // Without a color a new row takes the column default (primary)
    ...(color && { comment_color: color }),
  })

  if (error) {
    reportDatabaseRefusal('Failed to update comment', error)
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

  const { repository, ownerId } = await readCardRepository(supabase, repoCardId)

  const { error } = await writeRepositoryMemory(supabase, ownerId, repository, {
    comment_color: color,
  })

  if (error) {
    reportDatabaseRefusal('Failed to update comment color', error)
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

  const cleared = {
    comment: null,
    comment_color: DEFAULT_COMMENT_COLOR,
  }
  const githubRepoId = repository.github_repo_id
  // The note the card shows is the row with this id, which may still spell
  // the name from before a rename
  if (typeof githubRepoId === 'number') {
    const found = await findMemoryIdByGitHubRepoId(
      supabase,
      ownerId,
      githubRepoId,
    )
    if (found.error) {
      reportDatabaseRefusal('Failed to delete comment', found.error)
    }
    if (found.id) {
      const { error } = await supabase
        .from('projectinfo')
        .update(cleared)
        .eq('id', found.id)
        .eq('user_id', ownerId)
      if (error) {
        reportDatabaseRefusal('Failed to delete comment', error)
      }
      return
    }

    // Do not clear a comment that belongs to a different repository's id
    const byName = await findMemoryByRepoKey(supabase, ownerId, repository)
    if (byName.error) {
      reportDatabaseRefusal('Failed to delete comment', byName.error)
    }
    if (memoryBelongsToAnotherRepository(byName.githubRepoId, githubRepoId)) {
      return
    }
  }

  // The key is the same for every user holding the repository: the owner
  // filter keeps the update to this user's row whatever row level security
  // does. A repository with nothing saved matches no row and nothing changes
  const { error } = await supabase
    .from('projectinfo')
    .update(cleared)
    .eq('user_id', ownerId)
    .eq(
      'repo_key',
      toRepoIdentifier(repository.repo_owner, repository.repo_name),
    )

  if (error) {
    reportDatabaseRefusal('Failed to delete comment', error)
  }
}

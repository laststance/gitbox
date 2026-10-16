/**
 * What is saved for each repository of the user (issue #216).
 *
 * The note, links and comment of a repository outlive its card. The Add
 * Repositories picker marks a repository on no board whose memory holds
 * something, so the user sees what comes back when it is added again.
 * `saved_repository_mark` answers the three values (a note with text, a link
 * count, a comment with text) and leaves out repositories that sit on a
 * board. This module pages that view. {@link getSavedRepositoryMemories}
 * is the caller.
 *
 * NOT a 'use server' module: the route and the Server Action call it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createModuleLogger } from '@/lib/logger'
import type { Database, Tables } from '@/lib/supabase/types'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
import { readEveryRow } from '@/lib/utils/read-every-row'
import { isSlateValueEmpty, parseSlateValue } from '@/lib/utils/slate-utils'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'

import { normalizeLinks } from './project-info-core'

const log = createModuleLogger('saved-repository-memories')

/**
 * The parts of a repository's memory the picker names.
 *
 * @example
 * { identifier: 'laststance/gitbox', hasNote: true, linkCount: 3, hasComment: false }
 */
export interface SavedRepositoryMemory {
  /** Lowercase `owner/name` ({@link toRepoIdentifier}). */
  identifier: RepoIdentifier
  /** The note holds text other than whitespace (read as the editor's document). */
  hasNote: boolean
  /** Links with a URL, counted after {@link normalizeLinks}. */
  linkCount: number
  /** The comment holds text other than whitespace (its color alone does not count). */
  hasComment: boolean
}

type MemoryRow = Pick<
  Tables<'projectinfo'>,
  'repo_owner' | 'repo_name' | 'note' | 'comment' | 'links'
>

type MarkRow = Pick<
  Tables<'saved_repository_mark'>,
  'repo_owner' | 'repo_name' | 'has_note' | 'link_count' | 'has_comment'
>

/**
 * Loads the picker's marks for the signed-in user.
 *
 * Called by {@link getSavedRepositoryMemories}. The view already leaves out
 * a repository that sits on a board and a row that holds nothing; a row that
 * arrives with all three empty is dropped here as well. The read is ordered
 * by id and continues past the PostgREST row cap, so a mark past the first
 * thousand rows still reaches the picker. The note body is not selected.
 *
 * @param supabase - Authenticated Supabase client (RLS applies).
 * @param userId - The current user's id (`claims.sub`).
 * @returns One {@link SavedRepositoryMemory} per repository that holds something.
 * @throws When the query fails.
 * @example
 * await lookupSavedRepositoryMemories(supabase, claims.sub)
 * // => [{ identifier: 'a/b', hasNote: true, linkCount: 0, hasComment: true }]
 */
export async function lookupSavedRepositoryMemories(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SavedRepositoryMemory[]> {
  // One read stops at the row cap. A mark past it would leave the picker
  // without its Saved label, although adding the repository would still show it.
  let rows: MarkRow[]
  try {
    rows = await readEveryRow((from, to) =>
      supabase
        .from('saved_repository_mark')
        .select('repo_owner, repo_name, has_note, link_count, has_comment')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(from, to),
    )
  } catch (error) {
    log.error({ error }, 'Saved repository memory lookup failed')
    throw new Error('Failed to look up saved repository memories')
  }

  return rows.flatMap((row) => {
    const memory = memoryFromMark(row)
    return memory === null ? [] : [memory]
  })
}

/**
 * Turns one view row into the mark the picker shows.
 *
 * The view is supposed to omit an empty row. This still drops one, so a row
 * that holds nothing cannot be labeled "Saved".
 *
 * @param row - One row of `saved_repository_mark`.
 * @returns The mark, or `null` when the row holds nothing.
 * @example
 * memoryFromMark({
 *   repo_owner: 'laststance',
 *   repo_name: 'nsx',
 *   has_note: true,
 *   link_count: 0,
 *   has_comment: false,
 * })
 * // => { identifier: 'laststance/nsx', hasNote: true, linkCount: 0, hasComment: false }
 */
function memoryFromMark(row: MarkRow): SavedRepositoryMemory | null {
  if (!row.has_note && !row.has_comment && row.link_count === 0) return null

  return {
    identifier: toRepoIdentifier(row.repo_owner, row.repo_name),
    hasNote: row.has_note,
    linkCount: row.link_count,
    hasComment: row.has_comment,
  }
}

/**
 * Says what one memory row holds, or `null` when it holds nothing worth a mark.
 *
 * @param row - A `projectinfo` row (links in the array or the legacy object form).
 * @returns
 * - A {@link SavedRepositoryMemory} when the note, a link or the comment has content
 * - `null` when all three are empty (a comment color alone included)
 * @example
 * summarizeMemoryRow({ repo_owner: 'A', repo_name: 'B', note: ' ', comment: null, links: [] }) // => null
 */
export function summarizeMemoryRow(
  row: MemoryRow,
): SavedRepositoryMemory | null {
  const hasNote = noteHoldsText(row.note)
  const hasComment = Boolean(row.comment?.trim())
  const linkCount = countLinksWithUrl(row.links)

  if (!hasNote && !hasComment && linkCount === 0) return null

  return {
    identifier: toRepoIdentifier(row.repo_owner, row.repo_name),
    hasNote,
    linkCount,
    hasComment,
  }
}

/**
 * Whether a stored note holds text, read as the editor document it is.
 *
 * The Note dialog stores an editor document (JSON): an emptied note is a
 * paragraph without text, not an empty string. A stored value that is no
 * such document (an array of something else from an older client) counts by
 * its raw text instead of throwing, so one odd row cannot take the marks of
 * every other repository with it.
 *
 * @param note - The stored `note`, or `null`.
 * @returns Whether the note has text other than whitespace.
 * @example
 * noteHoldsText('[{"type":"p","children":[{"text":""}]}]') // => false
 * noteHoldsText('[1]') // => true
 */
function noteHoldsText(note: string | null): boolean {
  try {
    return !isSlateValueEmpty(parseSlateValue(note))
  } catch {
    return Boolean(note?.trim())
  }
}

/**
 * Counts the links with a URL, as the Note dialog shows them.
 *
 * Links of a shape {@link normalizeLinks} cannot read (a URL that is no
 * string in the legacy form) count as none instead of throwing, for the same
 * reason as {@link noteHoldsText}.
 *
 * @param links - The stored `links` (array or legacy object form).
 * @returns The number of links whose URL is not blank.
 * @example
 * countLinksWithUrl([{ type: 'npm', url: 'https://www.npmjs.com/package/nsx' }]) // => 1
 * countLinksWithUrl({ production: [5] }) // => 0
 */
function countLinksWithUrl(links: MemoryRow['links']): number {
  try {
    return normalizeLinks(links).filter((link) => link.url.trim()).length
  } catch {
    return 0
  }
}

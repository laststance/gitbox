/**
 * What is saved for each repository of the user (issue #216).
 *
 * The note, links and comment of a repository outlive its card. The Add
 * Repositories picker marks a repository on no board whose memory holds
 * something, so the user sees what comes back when it is added again: this
 * module reads the memories, {@link getUserRepoPlacements} keeps the ones of
 * repositories on no board.
 *
 * NOT a 'use server' module: {@link getUserRepoPlacements} calls it on the server.
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import { POSTGREST_MAX_ROWS } from '@/lib/constants/postgrest'
import { createModuleLogger } from '@/lib/logger'
import type { Database, Tables } from '@/lib/supabase/types'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
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

/**
 * Loads what is saved for every repository of the user, placed or not.
 *
 * Called by {@link getUserRepoPlacements}, which leaves out the repositories that
 * sit on a board. Rows whose note, links and comment are all empty are
 * dropped here.
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
  const { data: rows, error } = await supabase
    .from('projectinfo')
    .select('repo_owner, repo_name, note, comment, links')
    .eq('user_id', userId)

  if (error) {
    log.error({ error }, 'Saved repository memory lookup failed')
    throw new Error('Failed to look up saved repository memories')
  }

  // Marks beyond the PostgREST row cap would be missing without a word
  if (rows.length >= POSTGREST_MAX_ROWS) {
    Sentry.captureMessage(
      'Saved repository memory lookup may be truncated at PostgREST row limit',
      { level: 'warning', extra: { userId, memoryCount: rows.length } },
    )
  }

  return rows
    .map(summarizeMemoryRow)
    .filter((memory): memory is SavedRepositoryMemory => memory !== null)
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

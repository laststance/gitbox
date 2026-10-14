/**
 * What is saved for repositories that sit on no board (issue #216).
 *
 * The note, links and comment of a repository outlive its card. The Add
 * Repositories picker marks a repository on no board whose memory holds
 * something, so the user sees what comes back when it is added again.
 *
 * NOT a 'use server' module: `getUserRepoPlacements` calls it on the server.
 */

import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'

import { POSTGREST_MAX_ROWS } from '@/lib/constants/postgrest'
import { createModuleLogger } from '@/lib/logger'
import type { Database, Tables } from '@/lib/supabase/types'
import type { RepoIdentifier } from '@/lib/types/domain-primitives'
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
  /** The note holds text other than whitespace. */
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
 * Called by `getUserRepoPlacements`, which leaves out the repositories that
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
  const hasNote = Boolean(row.note?.trim())
  const hasComment = Boolean(row.comment?.trim())
  const linkCount = normalizeLinks(row.links).filter((link) =>
    link.url.trim(),
  ).length

  if (!hasNote && !hasComment && linkCount === 0) return null

  return {
    identifier: toRepoIdentifier(row.repo_owner, row.repo_name),
    hasNote,
    linkCount,
    hasComment,
  }
}

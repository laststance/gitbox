/**
 * Confirms a repository's identity with the GitHub API.
 *
 * `meta.githubId` is whatever the browser sent. The number stored in
 * `github_repo_id`, and the number the unique index uses, has to be the id
 * GitHub itself returned for that owner and name. Called by
 * {@link addRepositoriesToBoard} before an insert and by
 * {@link getUserRepoPlacements} to fill cards that were saved before the
 * column existed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { createGitHubAxios, getGitHubToken } from '@/lib/axios-github'
import type { Database } from '@/lib/supabase/types'
import { toRepoIdentifier } from '@/lib/utils/to-repo-identifier'

/** How many unconfirmed cards one picker opening confirms. The next opening continues. */
const BACKFILL_BATCH_SIZE = 25

/** What GitHub says a repository is, ignoring anything the browser claimed. */
export interface VerifiedRepository {
  /** GitHub's numeric repository id. */
  id: number
  /** Owner login GitHub returned, which follows a rename or a transfer. */
  owner: string
  /** Repository name GitHub returned. */
  name: string
}

interface GitHubRepositoryResponse {
  id: number
  name: string
  owner: { login: string }
}

/**
 * Asks GitHub which repository `owner/name` is now.
 *
 * A rename answers with the same id and the current name, because the client
 * follows GitHub's redirect. A missing token or a failed request returns
 * null: nothing may store an id GitHub did not just confirm.
 *
 * @param owner - Owner login to look up.
 * @param name - Repository name to look up.
 * @returns The id, owner and name GitHub returned, or null when they could not be confirmed.
 * @example
 * const verified = await verifyRepositoryIdentity('laststance', 'gitbox')
 * verified?.id // => 12345
 */
export async function verifyRepositoryIdentity(
  owner: string,
  name: string,
): Promise<VerifiedRepository | null> {
  const token = await getGitHubToken()
  if (!token) return null

  const api = createGitHubAxios({
    token,
    clearTokenCookieOnUnauthorized: false,
  })
  try {
    const { data } = await api.get<GitHubRepositoryResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    )
    if (!Number.isInteger(data.id) || data.id <= 0) return null
    if (!data.owner?.login || !data.name) return null
    return { id: data.id, owner: data.owner.login, name: data.name }
  } catch {
    return null
  }
}

/**
 * Fills `github_repo_id` on cards that do not have one yet, from the GitHub API.
 *
 * Also copies that id onto the repository's memory, so the note keeps matching
 * the card after a rename. A card whose id is already taken by another card of
 * the user is left null: the unique index refuses the write, and deleting a
 * card is not this function's decision. One opening confirms at most
 * {@link BACKFILL_BATCH_SIZE} cards.
 *
 * @param supabase - Authenticated client. Row level security applies.
 * @param userId - The signed-in user (`claims.sub`).
 * @returns Nothing. Cards that GitHub did not confirm stay null.
 * @example
 * await backfillVerifiedRepositoryIds(supabase, claims.sub)
 */
export async function backfillVerifiedRepositoryIds(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('repocard')
    .select('id, repo_owner, repo_name, board!inner(user_id)')
    .eq('board.user_id', userId)
    .is('github_repo_id', null)
    .order('id', { ascending: true })
    .limit(BACKFILL_BATCH_SIZE)

  if (error) {
    throw new Error('Failed to list repositories without a confirmed GitHub id')
  }
  if (!data || data.length === 0) return

  for (const card of data) {
    const verified = await verifyRepositoryIdentity(
      card.repo_owner,
      card.repo_name,
    )
    if (!verified) continue

    const { error: cardError } = await supabase
      .from('repocard')
      .update({ github_repo_id: verified.id })
      .eq('id', card.id)
      .is('github_repo_id', null)

    // 23505: another card of this user already has this id. Leave this one.
    if (cardError) {
      if (cardError.code === '23505') continue
      throw new Error('Failed to store the confirmed GitHub id')
    }

    const { error: memoryError } = await supabase
      .from('projectinfo')
      .update({ github_repo_id: verified.id })
      .eq('user_id', userId)
      .eq('repo_key', toRepoIdentifier(card.repo_owner, card.repo_name))
      .is('github_repo_id', null)

    if (memoryError && memoryError.code !== '23505') {
      throw new Error('Failed to store the confirmed GitHub id on the memory')
    }
  }
}

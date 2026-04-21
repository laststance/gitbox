/**
 * Domain Model Mappers
 *
 * The trust boundary between Supabase rows and the application's domain
 * layer. Every mapper:
 * 1. camelCases snake_case columns,
 * 2. brands the ID fields via `src/lib/types/brands.ts` factories,
 * 3. coerces nullable timestamps/colors into safe defaults.
 *
 * Keeping the `as BoardId` / `as RepoCardId` casts confined to this file
 * means the rest of the codebase can enjoy nominal IDs without scattered
 * escape hatches.
 */

import type {
  RepoCardDomain,
  RepoCardMeta,
  StatusListDomain,
} from '@/lib/models/domain'
import type { Tables } from '@/lib/supabase/types'
import { toBoardId, toRepoCardId, toStatusListId } from '@/lib/types/brands'

type StatusListRow = Tables<'statuslist'>
type RepoCardRow = Tables<'repocard'>

/**
 * Convert a raw Supabase `statuslist` row into a {@link StatusListDomain}.
 * Applies safe defaults for nullable columns (color, timestamps).
 *
 * @param row - Raw row from `supabase.from('statuslist').select(...)`
 * @returns Fully-populated domain object with branded IDs
 *
 * @example
 * const domain = toStatusListDomain(row)
 * // { id: 'uuid' as StatusListId, title: 'Todo', color: '#6B7280', gridRow: 0, ... }
 */
export function toStatusListDomain(row: StatusListRow): StatusListDomain {
  return {
    id: toStatusListId(row.id),
    title: row.name,
    color: row.color ?? '#6B7280',
    gridRow: row.grid_row ?? 0,
    gridCol: row.grid_col ?? 0,
    boardId: toBoardId(row.board_id),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Convert a raw Supabase `repocard` row into a {@link RepoCardDomain}.
 * Parses the JSON `meta` blob (cast-based; older rows may omit fields) and
 * derives the display title from `${repo_owner}/${repo_name}`.
 *
 * @param row - Raw row from `supabase.from('repocard').select(...)`
 * @returns Fully-populated domain object with branded IDs
 *
 * @example
 * const domain = toRepoCardDomain(row)
 * // { id: 'uuid' as RepoCardId, title: 'owner/repo', meta: { stars: 42 }, ... }
 */
export function toRepoCardDomain(row: RepoCardRow): RepoCardDomain {
  const meta = (row.meta as RepoCardMeta) || {}
  return {
    id: toRepoCardId(row.id),
    title: `${row.repo_owner}/${row.repo_name}`,
    description: meta.description || '',
    statusId: toStatusListId(row.status_id),
    boardId: toBoardId(row.board_id),
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    order: row.order,
    meta: {
      stars: meta.stars,
      updatedAt: meta.updatedAt,
      visibility: meta.visibility,
      language: meta.language,
      topics: meta.topics,
      description: meta.description,
    },
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Domain Model Mappers
 *
 * Converts Supabase database rows to domain models used in the application.
 * Centralizes mapping logic to avoid duplication across server actions.
 */

import type {
  RepoCardDomain,
  RepoCardMeta,
  StatusListDomain,
} from '@/lib/models/domain'
import type { Tables } from '@/lib/supabase/types'

type StatusListRow = Tables<'statuslist'>
type RepoCardRow = Tables<'repocard'>

/**
 * Convert a Supabase statuslist row to the application domain model.
 *
 * @param row - Raw database row from the statuslist table
 * @returns StatusListDomain with fallback defaults for nullable columns
 *
 * @example
 * const domain = toStatusListDomain(row)
 * // => { id: '...', title: 'Todo', color: '#6B7280', gridRow: 0, gridCol: 0, ... }
 */
export function toStatusListDomain(row: StatusListRow): StatusListDomain {
  return {
    id: row.id,
    title: row.name,
    color: row.color ?? '#6B7280',
    gridRow: row.grid_row ?? 0,
    gridCol: row.grid_col ?? 0,
    boardId: row.board_id,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Convert a Supabase repocard row to the application domain model.
 *
 * @param row - Raw database row from the repocard table
 * @returns RepoCardDomain with parsed meta and fallback defaults
 *
 * @example
 * const domain = toRepoCardDomain(row)
 * // => { id: '...', title: 'owner/repo', statusId: '...', meta: { stars: 42 }, ... }
 */
export function toRepoCardDomain(row: RepoCardRow): RepoCardDomain {
  const meta = (row.meta as RepoCardMeta) || {}
  return {
    id: row.id,
    title: `${row.repo_owner}/${row.repo_name}`,
    description: meta.description || '',
    statusId: row.status_id,
    boardId: row.board_id,
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

/**
 * Type Mappers
 *
 * Conversion functions between Database layer (Supabase types) and Domain layer
 * Ensures type-safe conversion and separates dependencies between layers
 */

import type {
  StatusList as DbStatusList,
  RepoCard as DbRepoCard,
} from '@/lib/supabase/types'

import type { StatusListDomain, RepoCardDomain, RepoCardMeta } from './domain'

// ========================================
// StatusList Mappers
// ========================================

/**
 * Database StatusList → Domain StatusList
 *
 * Converts database layer type to domain layer type
 * Field name mapping: name → title, wip_limit → wipLimit
 */
export function dbStatusListToDomain(db: DbStatusList): StatusListDomain {
  return {
    id: db.id,
    title: db.name, // name → title
    wipLimit: db.wip_limit ?? 0, // wip_limit → wipLimit (null -> 0)
    color: db.color ?? '#6366f1',
    gridRow: db.grid_row ?? 0, // grid_row → gridRow
    gridCol: db.grid_col ?? 0, // grid_col → gridCol
    boardId: db.board_id,
    createdAt: db.created_at ?? new Date().toISOString(),
    updatedAt: db.updated_at ?? new Date().toISOString(),
  }
}

// ========================================
// RepoCard Mappers
// ========================================

/**
 * Database RepoCard → Domain RepoCard
 *
 * Converts database layer type to domain layer type
 * Transforms GitHub repository information into UI display fields
 */
export function dbRepoCardToDomain(db: DbRepoCard): RepoCardDomain {
  // Type-safe meta extraction
  const meta = (db.meta as RepoCardMeta | null) ?? {}

  return {
    id: db.id,
    title: db.repo_name, // repo_name → title
    description: db.note ?? undefined, // note → description
    statusId: db.status_id,
    boardId: db.board_id,
    repoOwner: db.repo_owner,
    repoName: db.repo_name,
    note: db.note,
    order: db.order,
    meta,
    createdAt: db.created_at ?? new Date().toISOString(),
    updatedAt: db.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Type Mappers
 *
 * Conversion functions between Database layer (Supabase types) and Domain layer
 * Ensures type-safe conversion and separates dependencies between layers
 */

import type {
  StatusList as DbStatusList,
  RepoCard as DbRepoCard,
  Json,
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
    order: db.order,
    boardId: db.board_id,
    createdAt: db.created_at ?? new Date().toISOString(),
    updatedAt: db.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Domain StatusList → Database StatusList (Insert)
 *
 * Converts domain layer type to database insert type
 */
export function domainStatusListToDbInsert(
  domain: Omit<StatusListDomain, 'id' | 'createdAt' | 'updatedAt'>,
): Omit<DbStatusList, 'id' | 'created_at' | 'updated_at'> {
  return {
    board_id: domain.boardId,
    name: domain.title, // title → name
    wip_limit: domain.wipLimit, // wipLimit → wip_limit
    color: domain.color,
    order: domain.order,
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

/**
 * Domain RepoCard → Database RepoCard (Insert)
 *
 * Converts domain layer type to database insert type
 */
export function domainRepoCardToDbInsert(
  domain: Omit<
    RepoCardDomain,
    'id' | 'createdAt' | 'updatedAt' | 'title' | 'description'
  >,
): Omit<DbRepoCard, 'id' | 'created_at' | 'updated_at'> {
  return {
    board_id: domain.boardId,
    status_id: domain.statusId,
    repo_owner: domain.repoOwner,
    repo_name: domain.repoName,
    note: domain.note,
    order: domain.order,
    meta: domain.meta as unknown as Json, // Convert to Json type
  }
}

// ========================================
// Batch Mappers
// ========================================

/**
 * Batch conversion of StatusList array: Database → Domain
 */
export function dbStatusListsToDomain(
  dbList: DbStatusList[],
): StatusListDomain[] {
  return dbList.map(dbStatusListToDomain)
}

/**
 * Batch conversion of RepoCard array: Database → Domain
 */
export function dbRepoCardsToDomain(dbList: DbRepoCard[]): RepoCardDomain[] {
  return dbList.map(dbRepoCardToDomain)
}

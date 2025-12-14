/**
 * Type Mappers
 *
 * Database層(Supabase types)とDomain層の変換関数
 * 型安全な変換を保証し、レイヤー間の依存を分離
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
 * データベース層の型をドメイン層の型に変換
 * フィールド名の変換: name → title, wip_limit → wipLimit
 */
export function dbStatusListToDomain(db: DbStatusList): StatusListDomain {
  return {
    id: db.id,
    title: db.name, // name → title
    wipLimit: db.wip_limit ?? 0, // wip_limit → wipLimit (null -> 0)
    color: db.color,
    order: db.order,
    boardId: db.board_id,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

/**
 * Domain StatusList → Database StatusList (Insert)
 *
 * ドメイン層の型をデータベース挿入用の型に変換
 */
export function domainStatusListToDbInsert(
  domain: Omit<StatusListDomain, 'id' | 'createdAt' | 'updatedAt'>
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
 * データベース層の型をドメイン層の型に変換
 * GitHubリポジトリ情報をUI表示用フィールドに変換
 */
export function dbRepoCardToDomain(db: DbRepoCard): RepoCardDomain {
  // meta の型安全な取得
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
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

/**
 * Domain RepoCard → Database RepoCard (Insert)
 *
 * ドメイン層の型をデータベース挿入用の型に変換
 */
export function domainRepoCardToDbInsert(
  domain: Omit<
    RepoCardDomain,
    'id' | 'createdAt' | 'updatedAt' | 'title' | 'description'
  >
): Omit<DbRepoCard, 'id' | 'created_at' | 'updated_at'> {
  return {
    board_id: domain.boardId,
    status_id: domain.statusId,
    repo_owner: domain.repoOwner,
    repo_name: domain.repoName,
    note: domain.note,
    order: domain.order,
    meta: domain.meta as any, // Json型に変換
  }
}

// ========================================
// Batch Mappers
// ========================================

/**
 * StatusList配列の一括変換: Database → Domain
 */
export function dbStatusListsToDomain(dbList: DbStatusList[]): StatusListDomain[] {
  return dbList.map(dbStatusListToDomain)
}

/**
 * RepoCard配列の一括変換: Database → Domain
 */
export function dbRepoCardsToDomain(dbList: DbRepoCard[]): RepoCardDomain[] {
  return dbList.map(dbRepoCardToDomain)
}

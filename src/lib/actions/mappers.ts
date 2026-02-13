/**
 * Domain Model Mappers
 *
 * Converts Supabase database rows to domain models used in the application.
 * Centralizes mapping logic to avoid duplication across server actions.
 */

import type { StatusListDomain } from '@/lib/models/domain'
import type { Tables } from '@/lib/supabase/types'

type StatusListRow = Tables<'statuslist'>

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

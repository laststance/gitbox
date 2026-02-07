/**
 * Supabase Direct Query Helper for E2E Tests
 *
 * Provides direct database access for CRUD verification in tests.
 * Connects to local Supabase instance (127.0.0.1:54321).
 *
 * @example
 * ```ts
 * // Verify board was created
 * const boards = await querySupabase<Board>('board', { user_id: USER_ID })
 * expect(boards).toHaveLength(1)
 *
 * // Verify card was deleted
 * const cards = await querySupabase<RepoCard>('repocard', { id: CARD_ID })
 * expect(cards).toHaveLength(0)
 * ```
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Local Supabase configuration
// In parallel mode, each shard has its own PostgREST instance via nginx proxy.
// The NEXT_PUBLIC_SUPABASE_URL env var points to the shard's proxy (e.g., http://127.0.0.1:54400).
// In single-shard mode, falls back to main Supabase at port 54321.
const LOCAL_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
// Local Supabase anon key (from `supabase status`)
// This is a well-known test key for local development
const LOCAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

/**
 * Create a Supabase client for direct database queries.
 * Uses local Supabase instance.
 *
 * @returns Supabase client configured for local instance
 */
function createLocalSupabaseClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY)
}

/**
 * Query Supabase table with optional filters.
 *
 * @param table - Table name to query
 * @param filters - Optional key-value filters to apply (uses eq filter)
 * @returns Array of matching records
 *
 * @example
 * // Get all boards for a user
 * const boards = await querySupabase('board', { user_id: 'user-123' })
 *
 * // Get specific card
 * const cards = await querySupabase('repocard', { id: 'card-123' })
 */
export async function querySupabase<T>(
  table: string,
  filters?: Record<string, string | number | boolean>,
): Promise<T[]> {
  const supabase = createLocalSupabaseClient()

  let query = supabase.from(table).select('*')

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Supabase query failed on ${table}: ${error.message}`)
  }

  return (data ?? []) as T[]
}

/**
 * Query single record from Supabase table.
 *
 * @param table - Table name to query
 * @param filters - Key-value filters to apply
 * @returns Single record or null if not found
 *
 * @example
 * const board = await querySingle('board', { id: 'board-123' })
 * expect(board?.name).toBe('My Board')
 */
export async function querySingle<T>(
  table: string,
  filters: Record<string, string | number | boolean>,
): Promise<T | null> {
  const supabase = createLocalSupabaseClient()

  let query = supabase.from(table).select('*')

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value)
  }

  const { data, error } = await query.single()

  if (error) {
    // PGRST116 = "The result contains 0 rows" - this is expected for not found
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Supabase query failed on ${table}: ${error.message}`)
  }

  return data as T
}

/**
 * Count records in Supabase table with optional filters.
 *
 * @param table - Table name to query
 * @param filters - Optional key-value filters to apply
 * @returns Number of matching records
 *
 * @example
 * const cardCount = await countRecords('repocard', { board_id: 'board-123' })
 * expect(cardCount).toBe(5)
 */
export async function countRecords(
  table: string,
  filters?: Record<string, string | number | boolean>,
): Promise<number> {
  const supabase = createLocalSupabaseClient()

  let query = supabase.from(table).select('*', { count: 'exact', head: true })

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`Supabase count failed on ${table}: ${error.message}`)
  }

  return count ?? 0
}

// ============================================================================
// Test Data UUIDs (matching seed.sql)
// ============================================================================

/** Test user UUID */
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

/** Board UUIDs */
export const BOARD_IDS = {
  testBoard: '00000000-0000-0000-0000-000000000100',
  workProjects: '00000000-0000-0000-0000-000000000101',
} as const

/** Status list UUIDs */
export const STATUS_IDS = {
  pending: '00000000-0000-0000-0000-000000000201',
  planning: '00000000-0000-0000-0000-000000000202',
  focusDevelopment: '00000000-0000-0000-0000-000000000203',
  mvpRelease: '00000000-0000-0000-0000-000000000204',
  productionRelease: '00000000-0000-0000-0000-000000000205',
} as const

/** Repo card UUIDs */
export const CARD_IDS = {
  card1: '00000000-0000-0000-0000-000000000301',
  card2: '00000000-0000-0000-0000-000000000302',
  card3: '00000000-0000-0000-0000-000000000303',
  card4: '00000000-0000-0000-0000-000000000304',
  card5: '00000000-0000-0000-0000-000000000305',
} as const

/** Project info UUIDs */
export const PROJECT_INFO_IDS = {
  projinfo1: '00000000-0000-0000-0000-000000000401',
  projinfo2: '00000000-0000-0000-0000-000000000402',
  projinfo3: '00000000-0000-0000-0000-000000000403',
  projinfo4: '00000000-0000-0000-0000-000000000404',
} as const

/** Maintenance item UUIDs */
export const MAINTENANCE_IDS = {
  maintenance1: '00000000-0000-0000-0000-000000000501',
  maintenance2: '00000000-0000-0000-0000-000000000502',
} as const

/** Maintenance project info UUID */
export const MAINTENANCE_PROJECT_INFO_ID =
  '00000000-0000-0000-0000-000000000601'

// ============================================================================
// State Reset Helpers (for test isolation with real DB)
// ============================================================================

/**
 * Reset all status list (column) positions to seed.sql initial values.
 * Call this in beforeEach for DnD column tests to ensure clean state.
 *
 * @example
 * test.beforeEach(async () => {
 *   await resetStatusListPositions()
 * })
 */
export async function resetStatusListPositions(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  const seedPositions = [
    { id: STATUS_IDS.pending, order: 0, grid_row: 0, grid_col: 0 },
    { id: STATUS_IDS.planning, order: 1, grid_row: 0, grid_col: 1 },
    { id: STATUS_IDS.focusDevelopment, order: 2, grid_row: 0, grid_col: 2 },
    { id: STATUS_IDS.mvpRelease, order: 3, grid_row: 0, grid_col: 3 },
    { id: STATUS_IDS.productionRelease, order: 4, grid_row: 0, grid_col: 4 },
  ]

  for (const pos of seedPositions) {
    const { data, error } = await supabase
      .from('statuslist')
      .update({
        order: pos.order,
        grid_row: pos.grid_row,
        grid_col: pos.grid_col,
      })
      .eq('id', pos.id)
      .select('id')
    if (error) {
      throw new Error(`Failed to reset statuslist ${pos.id}: ${error.message}`)
    }
    if (!data || data.length === 0) {
      throw new Error(
        `resetStatusListPositions: UPDATE matched 0 rows for id=${pos.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
  }
}

/**
 * Reset project info comments to seed.sql initial values.
 * Call this in beforeEach for comment-related tests to ensure clean state.
 *
 * @example
 * test.beforeEach(async () => {
 *   await resetProjectInfoComments()
 * })
 */
export async function resetProjectInfoComments(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  const seedComments = [
    {
      id: PROJECT_INFO_IDS.projinfo1,
      comment: 'npmリリース完了、当分は機能追加予定なし',
      comment_color: 'primary',
    },
    {
      id: PROJECT_INFO_IDS.projinfo2,
      comment: 'プロトタイプ作ったけど微妙、差分表示エディタで苦戦中',
      comment_color: 'primary',
    },
    { id: PROJECT_INFO_IDS.projinfo3, comment: '', comment_color: 'primary' },
    {
      id: PROJECT_INFO_IDS.projinfo4,
      comment: 'v2.0リリース準備中',
      comment_color: 'primary',
    },
  ]

  for (const item of seedComments) {
    const { data, error } = await supabase
      .from('projectinfo')
      .update({ comment: item.comment, comment_color: item.comment_color })
      .eq('id', item.id)
      .select('id, comment, comment_color')
    if (error) {
      throw new Error(
        `Failed to reset projectinfo ${item.id}: ${error.message}`,
      )
    }
    // Verify the update actually affected a row and returned correct data
    if (!data || data.length === 0) {
      throw new Error(
        `resetProjectInfoComments: UPDATE matched 0 rows for id=${item.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
    const returned = data[0] as { comment: string; comment_color: string }
    if (returned.comment !== item.comment) {
      throw new Error(
        `resetProjectInfoComments: UPDATE returned wrong comment for id=${item.id}. ` +
          `Expected="${item.comment}" Got="${returned.comment}"`,
      )
    }
  }
}

/**
 * Reset all repo card positions to seed.sql initial values.
 * Call this in beforeEach for DnD card tests to ensure clean state.
 *
 * @example
 * test.beforeEach(async () => {
 *   await resetCardPositions()
 * })
 */
export async function resetCardPositions(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  const seedPositions = [
    { id: CARD_IDS.card1, status_id: STATUS_IDS.planning, order: 0 },
    { id: CARD_IDS.card2, status_id: STATUS_IDS.focusDevelopment, order: 0 },
    { id: CARD_IDS.card3, status_id: STATUS_IDS.pending, order: 0 },
    { id: CARD_IDS.card4, status_id: STATUS_IDS.planning, order: 1 },
    { id: CARD_IDS.card5, status_id: STATUS_IDS.planning, order: 2 },
  ]

  for (const pos of seedPositions) {
    const { data, error } = await supabase
      .from('repocard')
      .update({ status_id: pos.status_id, order: pos.order })
      .eq('id', pos.id)
      .select('id')
    if (error) {
      throw new Error(`Failed to reset repocard ${pos.id}: ${error.message}`)
    }
    if (!data || data.length === 0) {
      throw new Error(
        `resetCardPositions: UPDATE matched 0 rows for id=${pos.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
  }
}

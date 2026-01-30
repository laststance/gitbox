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
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
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

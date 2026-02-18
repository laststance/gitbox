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
// Local Supabase service_role key (from `supabase status`)
// This is a well-known test key for local development.
// service_role bypasses RLS, which is required for E2E setup/teardown helpers.
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/**
 * Create a Supabase client for direct database queries.
 * Uses service_role key to bypass RLS for setup/teardown operations.
 *
 * @returns Supabase client configured for local instance with admin access
 */
function createLocalSupabaseClient(): SupabaseClient {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY)
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

/**
 * Reset all repo cards to seed.sql initial state (upsert).
 * Re-creates cards that may have been deleted by other tests (e.g., remove-from-board).
 *
 * @example
 * test.beforeEach(async () => {
 *   await resetRepoCards()
 * })
 */
export async function resetRepoCards(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  // First, delete ALL cards from testBoard (including any added by previous tests)
  const { error: deleteError } = await supabase
    .from('repocard')
    .delete()
    .eq('board_id', BOARD_IDS.testBoard)
  if (deleteError) {
    throw new Error(`resetRepoCards: delete failed: ${deleteError.message}`)
  }

  const seedCards = [
    {
      id: CARD_IDS.card1,
      board_id: BOARD_IDS.testBoard,
      status_id: STATUS_IDS.planning,
      repo_owner: 'testuser',
      repo_name: 'test-repo',
      order: 0,
      meta: {
        stars: 42,
        language: 'TypeScript',
        topics: ['react', 'nextjs'],
        visibility: 'public',
        description: 'A test repository for GitBox',
        updatedAt: '2024-01-15T00:00:00.000Z',
      },
    },
    {
      id: CARD_IDS.card2,
      board_id: BOARD_IDS.testBoard,
      status_id: STATUS_IDS.focusDevelopment,
      repo_owner: 'testuser',
      repo_name: 'another-repo',
      order: 0,
      meta: {
        stars: 128,
        language: 'JavaScript',
        topics: ['nodejs', 'api'],
        visibility: 'public',
        description: 'Another test repository',
        updatedAt: '2024-01-10T00:00:00.000Z',
      },
    },
    {
      id: CARD_IDS.card3,
      board_id: BOARD_IDS.testBoard,
      status_id: STATUS_IDS.pending,
      repo_owner: 'laststance',
      repo_name: 'create-react-app-vite',
      order: 0,
      meta: {
        stars: 500,
        language: 'TypeScript',
        topics: ['vite', 'react', 'template'],
        visibility: 'public',
        description: 'Create React App + Vite template',
        updatedAt: '2024-01-20T00:00:00.000Z',
      },
    },
    {
      id: CARD_IDS.card4,
      board_id: BOARD_IDS.testBoard,
      status_id: STATUS_IDS.planning,
      repo_owner: 'laststance',
      repo_name: 'nsx',
      order: 1,
      meta: {
        stars: 85,
        language: 'TypeScript',
        topics: ['cli', 'monorepo', 'npm'],
        visibility: 'public',
        description: 'Monorepo workspace CLI tool',
        updatedAt: '2024-01-18T00:00:00.000Z',
      },
    },
    {
      id: CARD_IDS.card5,
      board_id: BOARD_IDS.testBoard,
      status_id: STATUS_IDS.planning,
      repo_owner: 'laststance',
      repo_name: 'use-app-state',
      order: 2,
      meta: {
        stars: 120,
        language: 'TypeScript',
        topics: ['react', 'hooks', 'state'],
        visibility: 'public',
        description: 'Simple React state management hook',
        updatedAt: '2024-01-12T00:00:00.000Z',
      },
    },
  ]

  for (const card of seedCards) {
    const { error } = await supabase
      .from('repocard')
      .upsert(card, { onConflict: 'id' })
    if (error) {
      throw new Error(
        `resetRepoCards: upsert failed for id=${card.id}: ${error.message}`,
      )
    }
  }

  // Re-insert projectinfo rows that were deleted by CASCADE when repocards
  // were deleted above. Card5 intentionally has no projectinfo (seed.sql design).
  const seedProjectInfos = [
    {
      id: PROJECT_INFO_IDS.projinfo1,
      repo_card_id: CARD_IDS.card1,
      note: 'Important project notes here',
      comment: 'npmリリース完了、当分は機能追加予定なし',
      comment_color: 'primary',
      links: [
        { title: 'Documentation', url: 'https://docs.example.com' },
        { title: 'Staging', url: 'https://staging.example.com' },
      ],
    },
    {
      id: PROJECT_INFO_IDS.projinfo2,
      repo_card_id: CARD_IDS.card2,
      note: 'Another repo notes',
      comment: 'プロトタイプ作ったけど微妙、差分表示エディタで苦戦中',
      comment_color: 'primary',
      links: [],
    },
    {
      id: PROJECT_INFO_IDS.projinfo3,
      repo_card_id: CARD_IDS.card3,
      note: '',
      comment: '',
      comment_color: 'primary',
      links: [],
    },
    {
      id: PROJECT_INFO_IDS.projinfo4,
      repo_card_id: CARD_IDS.card4,
      note: 'CLI tool documentation',
      comment: 'v2.0リリース準備中',
      comment_color: 'primary',
      links: [{ title: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
    },
  ]

  for (const info of seedProjectInfos) {
    const { error } = await supabase
      .from('projectinfo')
      .upsert(info, { onConflict: 'id' })
    if (error) {
      throw new Error(
        `resetRepoCards: projectinfo upsert failed for id=${info.id}: ${error.message}`,
      )
    }
  }
}

/**
 * Reset board names to seed.sql initial values.
 * Call this in afterEach for board rename tests to prevent cross-test contamination.
 *
 * @example
 * test.afterEach(async () => {
 *   await resetBoardNames()
 * })
 */
export async function resetBoardNames(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  const seedNames = [
    { id: BOARD_IDS.testBoard, name: 'Test Board' },
    { id: BOARD_IDS.workProjects, name: 'Work Projects' },
  ]

  for (const item of seedNames) {
    const { data, error } = await supabase
      .from('board')
      .update({ name: item.name })
      .eq('id', item.id)
      .select('id')
    if (error) {
      throw new Error(
        `resetBoardNames: failed for id=${item.id}: ${error.message}`,
      )
    }
    if (!data || data.length === 0) {
      throw new Error(
        `resetBoardNames: UPDATE matched 0 rows for id=${item.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
  }
}

/**
 * Reset board subtitles to seed.sql initial values.
 * Call this in afterEach for board subtitle tests to prevent cross-test contamination.
 *
 * @example
 * test.afterEach(async () => {
 *   await resetBoardSubtitles()
 * })
 */
export async function resetBoardSubtitles(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  const seedSubtitles: { id: string; subtitle: string | null }[] = [
    { id: BOARD_IDS.testBoard, subtitle: 'Main testing board for E2E' },
    { id: BOARD_IDS.workProjects, subtitle: null },
  ]

  for (const item of seedSubtitles) {
    const { data, error } = await supabase
      .from('board')
      .update({ subtitle: item.subtitle })
      .eq('id', item.id)
      .select('id')
    if (error) {
      throw new Error(
        `resetBoardSubtitles: failed for id=${item.id}: ${error.message}`,
      )
    }
    if (!data || data.length === 0) {
      throw new Error(
        `resetBoardSubtitles: UPDATE matched 0 rows for id=${item.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
  }
}

/**
 * Reset status list (column) names to seed.sql initial values.
 * Call this in afterEach for column rename tests to prevent cross-test contamination.
 *
 * @example
 * test.afterEach(async () => {
 *   await resetStatusListNames()
 * })
 */
export async function resetStatusListNames(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  const seedNames = [
    { id: STATUS_IDS.pending, name: 'Pending' },
    { id: STATUS_IDS.planning, name: 'Planning' },
    { id: STATUS_IDS.focusDevelopment, name: 'Focus Development' },
    { id: STATUS_IDS.mvpRelease, name: 'MVP Release' },
    { id: STATUS_IDS.productionRelease, name: 'Production Release' },
  ]

  for (const item of seedNames) {
    const { data, error } = await supabase
      .from('statuslist')
      .update({ name: item.name })
      .eq('id', item.id)
      .select('id')
    if (error) {
      throw new Error(
        `resetStatusListNames: failed for id=${item.id}: ${error.message}`,
      )
    }
    if (!data || data.length === 0) {
      throw new Error(
        `resetStatusListNames: UPDATE matched 0 rows for id=${item.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
  }
}

/**
 * Reset board positions to seed.sql initial values.
 * Call this in afterEach for board DnD tests to prevent cross-test contamination.
 *
 * Seed positions:
 * - workProjects (board-2): position=0 (first, newer)
 * - testBoard (board-1): position=1 (second, older)
 *
 * @example
 * test.afterEach(async () => {
 *   await resetBoardPositions()
 * })
 */
export async function resetBoardPositions(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  const seedPositions = [
    { id: BOARD_IDS.workProjects, position: 0 },
    { id: BOARD_IDS.testBoard, position: 1 },
  ]

  for (const item of seedPositions) {
    const { data, error } = await supabase
      .from('board')
      .update({ position: item.position })
      .eq('id', item.id)
      .select('id')
    if (error) {
      throw new Error(
        `resetBoardPositions: failed for id=${item.id}: ${error.message}`,
      )
    }
    if (!data || data.length === 0) {
      throw new Error(
        `resetBoardPositions: UPDATE matched 0 rows for id=${item.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
  }
}

/**
 * Reset projectinfo links to seed.sql initial values.
 * Call this in afterEach for link persistence tests to prevent cross-test contamination.
 *
 * @example
 * test.afterEach(async () => {
 *   await resetProjectInfoLinks()
 * })
 */
export async function resetProjectInfoLinks(): Promise<void> {
  const supabase = createLocalSupabaseClient()

  // Seed data: projinfo3 (card-3: laststance/create-react-app-vite) has empty links
  const seedLinks = [{ id: PROJECT_INFO_IDS.projinfo3, links: [] as unknown[] }]

  for (const item of seedLinks) {
    const { data, error } = await supabase
      .from('projectinfo')
      .update({ links: item.links })
      .eq('id', item.id)
      .select('id')
    if (error) {
      throw new Error(
        `resetProjectInfoLinks: failed for id=${item.id}: ${error.message}`,
      )
    }
    if (!data || data.length === 0) {
      throw new Error(
        `resetProjectInfoLinks: UPDATE matched 0 rows for id=${item.id}. ` +
          `URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}`,
      )
    }
  }
}

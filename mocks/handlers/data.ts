/**
 * Shared Mock Data for MSW Handlers
 *
 * Contains mock data, types, constants, and helper functions
 * used by both Supabase and GitHub API handlers.
 *
 * @see https://mswjs.io/docs/concepts/request-handler
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Supabase base URL from environment
 * Falls back to development instance if not set
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://jqtxjzdxczqwsrvevmyk.supabase.co'

export const GITHUB_API_URL = 'https://api.github.com'

// ============================================================================
// Mock Data Types
// ============================================================================

/**
 * Mock user data for authentication
 */
export interface MockUser {
  id: string
  email: string
  app_metadata: {
    provider: string
    providers: string[]
  }
  user_metadata: {
    avatar_url: string
    email: string
    full_name: string
    user_name: string
  }
  created_at: string
}

/**
 * Mock session data
 */
export interface MockSession {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  token_type: string
  user: MockUser
}

// ============================================================================
// Mock Data Constants
// ============================================================================

export const MOCK_USER_ID = 'test-user-id-12345'
export const MOCK_BOARD_ID = 'board-1'
export const MOCK_STATUS_IDS = {
  backlog: 'status-1',
  todo: 'status-2',
  inProgress: 'status-3',
  review: 'status-4',
  done: 'status-5',
}
export const MOCK_CARD_ID = 'card-1'

/**
 * Mock Supabase user
 */
export const mockUser: MockUser = {
  id: MOCK_USER_ID,
  email: 'test@gitbox.dev',
  app_metadata: {
    provider: 'github',
    providers: ['github'],
  },
  user_metadata: {
    avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    email: 'test@gitbox.dev',
    full_name: 'Test User',
    user_name: 'testuser',
  },
  created_at: '2024-01-01T00:00:00.000Z',
}

/**
 * Mock Supabase session
 */
export const mockSession: MockSession = {
  access_token: 'mock-access-token-xyz',
  refresh_token: 'mock-refresh-token-xyz',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser,
}

/**
 * Initial mock boards data (immutable reference for reset)
 */
const INITIAL_MOCK_BOARDS = [
  {
    id: MOCK_BOARD_ID,
    name: 'Test Board',
    user_id: MOCK_USER_ID,
    theme: 'sunrise',
    settings: null,
    is_favorite: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'board-2',
    name: 'Work Projects',
    user_id: MOCK_USER_ID,
    theme: 'midnight',
    settings: null,
    is_favorite: false,
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  },
]

export type MockBoard = (typeof INITIAL_MOCK_BOARDS)[number]

/**
 * Mock boards data (mutable to allow state persistence in tests)
 * Reset via POST /__msw__/reset endpoint between tests
 */
export let mockBoards: MockBoard[] = INITIAL_MOCK_BOARDS.map((b) => ({ ...b }))

/**
 * Reset mock data to initial state (called between tests for isolation)
 * Exported for use by the /__msw__/reset API route
 */
export function resetMockData(): void {
  mockBoards = INITIAL_MOCK_BOARDS.map((b) => ({ ...b }))
}

/**
 * Update a board in the mock data array
 *
 * @param boardId - Board ID to update
 * @param updates - Partial board data to merge
 * @returns Updated board or null if not found
 */
export function updateMockBoard(
  boardId: string,
  updates: Partial<MockBoard>,
): MockBoard | null {
  const index = mockBoards.findIndex((b) => b.id === boardId)
  if (index === -1) return null

  mockBoards[index] = {
    ...mockBoards[index],
    ...updates,
    updated_at: new Date().toISOString(),
  }
  return mockBoards[index]
}

/**
 * Mock status lists (Kanban columns)
 */
export const mockStatusLists = [
  {
    id: MOCK_STATUS_IDS.backlog,
    name: 'Pending',
    board_id: MOCK_BOARD_ID,
    color: '#8B7355',
    order: 0,
    grid_row: 0,
    grid_col: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.todo,
    name: 'Planning',
    board_id: MOCK_BOARD_ID,
    color: '#6B8E23',
    order: 1,
    grid_row: 0,
    grid_col: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.inProgress,
    name: 'Focus Development',
    board_id: MOCK_BOARD_ID,
    color: '#CD853F',
    order: 2,
    grid_row: 0,
    grid_col: 2,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.review,
    name: 'MVP Release',
    board_id: MOCK_BOARD_ID,
    color: '#4682B4',
    order: 3,
    grid_row: 0,
    grid_col: 3,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.done,
    name: 'Production Release',
    board_id: MOCK_BOARD_ID,
    color: '#556B2F',
    order: 4,
    grid_row: 0,
    grid_col: 4,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
]

/**
 * Mock repo cards
 */
export const mockRepoCards = [
  {
    id: MOCK_CARD_ID,
    board_id: MOCK_BOARD_ID,
    status_id: MOCK_STATUS_IDS.todo,
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
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'card-2',
    board_id: MOCK_BOARD_ID,
    status_id: MOCK_STATUS_IDS.inProgress,
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
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-05T00:00:00.000Z',
  },
  {
    id: 'card-3',
    board_id: MOCK_BOARD_ID,
    status_id: MOCK_STATUS_IDS.backlog,
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
    created_at: '2024-01-03T00:00:00.000Z',
    updated_at: '2024-01-03T00:00:00.000Z',
  },
  // Additional cards in To Do column for intra-column reorder E2E testing
  {
    id: 'card-4',
    board_id: MOCK_BOARD_ID,
    status_id: MOCK_STATUS_IDS.todo,
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
    created_at: '2024-01-04T00:00:00.000Z',
    updated_at: '2024-01-04T00:00:00.000Z',
  },
  {
    id: 'card-5',
    board_id: MOCK_BOARD_ID,
    status_id: MOCK_STATUS_IDS.todo,
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
    created_at: '2024-01-05T00:00:00.000Z',
    updated_at: '2024-01-05T00:00:00.000Z',
  },
]

/**
 * Mock GitHub user
 */
export const mockGitHubUser = {
  id: 12345,
  login: 'testuser',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
  name: 'Test User',
  type: 'User' as const,
  html_url: 'https://github.com/testuser',
  email: 'test@gitbox.dev',
}

/**
 * Mock GitHub repositories
 */
export const mockGitHubRepos = [
  {
    id: 1,
    node_id: 'R_kgDOGq0qMQ',
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    owner: {
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    description: 'A test repository for GitBox',
    html_url: 'https://github.com/testuser/test-repo',
    homepage: 'https://test-repo.dev',
    stargazers_count: 42,
    watchers_count: 42,
    language: 'TypeScript',
    topics: ['react', 'nextjs'],
    visibility: 'public' as const,
    updated_at: '2024-01-15T00:00:00.000Z',
    created_at: '2023-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    node_id: 'R_kgDOGq0qMg',
    name: 'another-repo',
    full_name: 'testuser/another-repo',
    owner: {
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    description: 'Another test repository',
    html_url: 'https://github.com/testuser/another-repo',
    homepage: null,
    stargazers_count: 128,
    watchers_count: 128,
    language: 'JavaScript',
    topics: ['nodejs', 'api'],
    visibility: 'public' as const,
    updated_at: '2024-01-10T00:00:00.000Z',
    created_at: '2023-06-01T00:00:00.000Z',
  },
  {
    id: 3,
    node_id: 'R_kgDOGq0qMz',
    name: 'private-project',
    full_name: 'testuser/private-project',
    owner: {
      login: 'testuser',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    description: 'A private project',
    html_url: 'https://github.com/testuser/private-project',
    homepage: null,
    stargazers_count: 0,
    watchers_count: 1,
    language: 'Python',
    topics: ['private', 'internal'],
    visibility: 'private' as const,
    updated_at: '2024-01-20T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
  },
]

/**
 * Mock GitHub organizations
 */
export const mockGitHubOrgs = [
  {
    id: 100,
    login: 'laststance',
    avatar_url: 'https://avatars.githubusercontent.com/u/100?v=4',
    description: 'Laststance.io organization',
  },
  {
    id: 101,
    login: 'test-org',
    avatar_url: 'https://avatars.githubusercontent.com/u/101?v=4',
    description: 'Test organization for development',
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse URL search params from request
 *
 * @param request - The incoming HTTP request
 * @returns Parsed URLSearchParams object
 */
export function getSearchParams(request: Request): URLSearchParams {
  const url = new URL(request.url)
  return url.searchParams
}

/**
 * Filter mock data based on query parameters
 *
 * @param data - Array of mock data items
 * @param params - URL search parameters
 * @returns Filtered data array
 */
export function filterByParams<T extends Record<string, unknown>>(
  data: T[],
  params: URLSearchParams,
): T[] {
  let filtered = [...data]

  // Handle Supabase PostgREST query parameters
  for (const [key, value] of params.entries()) {
    // Handle eq filter (e.g., board_id=eq.board-1, is_favorite=eq.true)
    if (value.startsWith('eq.')) {
      const filterValue = value.slice(3)
      filtered = filtered.filter((item) => {
        const itemValue = item[key]
        // Handle boolean comparisons (PostgREST sends "true"/"false" as strings)
        if (typeof itemValue === 'boolean') {
          return itemValue === (filterValue === 'true')
        }
        return itemValue === filterValue
      })
    }
  }

  return filtered
}

// ============================================================================
// Exported Mock Data (for use in tests/stories)
// ============================================================================

/**
 * Mock project info (comments, notes, links for cards)
 * Used for Phase 3: Comment Display on RepoCard
 */
export const mockProjectInfo = [
  {
    id: 'projinfo-1',
    repo_card_id: MOCK_CARD_ID,
    note: 'Important project notes here',
    comment: 'npmリリース完了、当分は機能追加予定なし',
    links: [
      { title: 'Documentation', url: 'https://docs.example.com' },
      { title: 'Staging', url: 'https://staging.example.com' },
    ],
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'projinfo-2',
    repo_card_id: 'card-2',
    note: 'Another repo notes',
    comment: 'プロトタイプ作ったけど微妙、差分表示エディタで苦戦中',
    links: [],
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'projinfo-3',
    repo_card_id: 'card-3',
    note: '',
    comment: '', // Empty comment for testing empty state
    links: [],
    created_at: '2024-01-03T00:00:00.000Z',
    updated_at: '2024-01-03T00:00:00.000Z',
  },
  {
    id: 'projinfo-4',
    repo_card_id: 'card-4',
    note: 'CLI tool documentation',
    comment: 'v2.0リリース準備中',
    links: [{ title: 'npm', url: 'https://www.npmjs.com/package/nsx' }],
    created_at: '2024-01-04T00:00:00.000Z',
    updated_at: '2024-01-04T00:00:00.000Z',
  },
  // card-5 has no projectinfo - testing when projectinfo doesn't exist
]

/**
 * Mock maintenance items (archived repositories)
 * Used for Maintenance page ProjectInfo E2E tests
 */
export const MOCK_MAINTENANCE_ID = 'maintenance-1'

export const mockMaintenance = [
  {
    id: MOCK_MAINTENANCE_ID,
    user_id: MOCK_USER_ID,
    repo_owner: 'laststance',
    repo_name: 'claude-plugin-dashboard',
    repo_card_id: null,
    note: 'Archived for maintenance',
    hidden: false,
    created_at: '2024-12-31T00:00:00.000Z',
    updated_at: '2024-12-31T00:00:00.000Z',
  },
  {
    id: 'maintenance-2',
    user_id: MOCK_USER_ID,
    repo_owner: 'laststance',
    repo_name: 'old-project',
    repo_card_id: null,
    note: 'Legacy project',
    hidden: false,
    created_at: '2024-11-01T00:00:00.000Z',
    updated_at: '2024-11-01T00:00:00.000Z',
  },
]

/**
 * Mock project info for maintenance items
 * Links maintenance_id instead of repo_card_id
 */
export const mockMaintenanceProjectInfo = [
  {
    id: 'projinfo-maint-1',
    repo_card_id: null,
    maintenance_id: MOCK_MAINTENANCE_ID,
    note: 'Maintenance notes for dashboard project',
    comment: 'Archived - no active development',
    comment_color: 'neutral',
    links: [],
    created_at: '2024-12-31T00:00:00.000Z',
    updated_at: '2024-12-31T00:00:00.000Z',
  },
]

export const mockData = {
  user: mockUser,
  session: mockSession,
  boards: mockBoards,
  statusLists: mockStatusLists,
  repoCards: mockRepoCards,
  projectInfo: mockProjectInfo,
  maintenance: mockMaintenance,
  maintenanceProjectInfo: mockMaintenanceProjectInfo,
  gitHubUser: mockGitHubUser,
  gitHubRepos: mockGitHubRepos,
  gitHubOrgs: mockGitHubOrgs,
  ids: {
    userId: MOCK_USER_ID,
    boardId: MOCK_BOARD_ID,
    statusIds: MOCK_STATUS_IDS,
    cardId: MOCK_CARD_ID,
    maintenanceId: MOCK_MAINTENANCE_ID,
  },
} as const

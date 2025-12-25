/**
 * MSW (Mock Service Worker) Request Handlers
 *
 * Comprehensive mock API handlers for Storybook and testing.
 * Covers Supabase Auth, Database (PostgREST), and GitHub API endpoints.
 *
 * @see https://mswjs.io/docs/concepts/request-handler
 */
import { http, HttpResponse, type HttpHandler } from 'msw'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Supabase base URL from environment
 * Falls back to development instance if not set
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://jqtxjzdxczqwsrvevmyk.supabase.co'

const GITHUB_API_URL = 'https://api.github.com'

// ============================================================================
// Mock Data Types
// ============================================================================

/**
 * Mock user data for authentication
 */
interface MockUser {
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
interface MockSession {
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

const MOCK_USER_ID = 'test-user-id-12345'
const MOCK_BOARD_ID = 'board-1'
const MOCK_STATUS_IDS = {
  backlog: 'status-1',
  todo: 'status-2',
  inProgress: 'status-3',
  review: 'status-4',
  done: 'status-5',
}
const MOCK_CARD_ID = 'card-1'

/**
 * Mock Supabase user
 */
const mockUser: MockUser = {
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
const mockSession: MockSession = {
  access_token: 'mock-access-token-xyz',
  refresh_token: 'mock-refresh-token-xyz',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser,
}

/**
 * Mock boards data
 */
const mockBoards = [
  {
    id: MOCK_BOARD_ID,
    name: 'Test Board',
    user_id: MOCK_USER_ID,
    theme: 'sunrise',
    settings: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'board-2',
    name: 'Work Projects',
    user_id: MOCK_USER_ID,
    theme: 'midnight',
    settings: null,
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  },
]

/**
 * Mock status lists (Kanban columns)
 */
const mockStatusLists = [
  {
    id: MOCK_STATUS_IDS.backlog,
    name: 'Backlog',
    board_id: MOCK_BOARD_ID,
    color: '#8B7355',
    order: 0,
    grid_row: 0,
    grid_col: 0,
    wip_limit: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.todo,
    name: 'To Do',
    board_id: MOCK_BOARD_ID,
    color: '#6B8E23',
    order: 1,
    grid_row: 0,
    grid_col: 1,
    wip_limit: 5,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.inProgress,
    name: 'In Progress',
    board_id: MOCK_BOARD_ID,
    color: '#CD853F',
    order: 2,
    grid_row: 0,
    grid_col: 2,
    wip_limit: 3,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.review,
    name: 'Review',
    board_id: MOCK_BOARD_ID,
    color: '#4682B4',
    order: 3,
    grid_row: 0,
    grid_col: 3,
    wip_limit: 4,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: MOCK_STATUS_IDS.done,
    name: 'Done',
    board_id: MOCK_BOARD_ID,
    color: '#556B2F',
    order: 4,
    grid_row: 0,
    grid_col: 4,
    wip_limit: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
]

/**
 * Mock repo cards
 */
const mockRepoCards = [
  {
    id: MOCK_CARD_ID,
    board_id: MOCK_BOARD_ID,
    status_id: MOCK_STATUS_IDS.todo,
    repo_owner: 'testuser',
    repo_name: 'test-repo',
    note: 'Main project repository',
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
    note: 'Work in progress',
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
    note: '',
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
]

/**
 * Mock GitHub user
 */
const mockGitHubUser = {
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
const mockGitHubRepos = [
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
const mockGitHubOrgs = [
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
 * @param request - The incoming HTTP request
 * @returns Parsed URLSearchParams object
 */
function getSearchParams(request: Request): URLSearchParams {
  const url = new URL(request.url)
  return url.searchParams
}

/**
 * Filter mock data based on query parameters
 * @param data - Array of mock data items
 * @param params - URL search parameters
 * @returns Filtered data array
 */
function filterByParams<T extends Record<string, unknown>>(
  data: T[],
  params: URLSearchParams,
): T[] {
  let filtered = [...data]

  // Handle Supabase PostgREST query parameters
  for (const [key, value] of params.entries()) {
    // Handle eq filter (e.g., board_id=eq.board-1)
    if (value.startsWith('eq.')) {
      const filterValue = value.slice(3)
      filtered = filtered.filter((item) => item[key] === filterValue)
    }
  }

  return filtered
}

// ============================================================================
// Supabase Auth Handlers
// ============================================================================

const supabaseAuthHandlers: HttpHandler[] = [
  /**
   * POST /auth/v1/token - Exchange code for session or refresh token
   */
  http.post(`${SUPABASE_URL}/auth/v1/token`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const grantType = body.grant_type

    if (grantType === 'refresh_token') {
      // Return refreshed session
      return HttpResponse.json({
        ...mockSession,
        access_token: 'refreshed-access-token-xyz',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      })
    }

    // Default: return session for authorization_code grant
    return HttpResponse.json(mockSession)
  }),

  /**
   * GET /auth/v1/user - Get current authenticated user
   *
   * For E2E tests: Always returns mock user to simulate authenticated state.
   * The cookie injection in auth.setup.ts triggers Supabase to call this endpoint.
   */
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    // Always return authenticated user for E2E tests
    // This allows tests to proceed without real OAuth flow
    return HttpResponse.json(mockUser)
  }),

  /**
   * POST /auth/v1/logout - Sign out user
   */
  http.post(`${SUPABASE_URL}/auth/v1/logout`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  /**
   * POST /auth/v1/signup - Create new user (not typically used with OAuth)
   */
  http.post(`${SUPABASE_URL}/auth/v1/signup`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }

    if (!body.email || !body.password) {
      return HttpResponse.json(
        {
          error: 'validation_failed',
          message: 'Email and password are required',
        },
        { status: 400 },
      )
    }

    return HttpResponse.json({
      user: { ...mockUser, email: body.email },
      session: mockSession,
    })
  }),
]

// ============================================================================
// Supabase Database (PostgREST) Handlers
// ============================================================================

const supabaseDbHandlers: HttpHandler[] = [
  // --------------------------------------------------------------------------
  // Board table handlers
  // --------------------------------------------------------------------------

  /**
   * GET /rest/v1/board - List boards
   */
  http.get(`${SUPABASE_URL}/rest/v1/board`, ({ request }) => {
    const params = getSearchParams(request)
    const filtered = filterByParams(mockBoards, params)

    // Handle select parameter for partial data
    const selectParam = params.get('select')
    if (selectParam === 'id, name') {
      return HttpResponse.json(
        filtered.map((b) => ({ id: b.id, name: b.name })),
      )
    }

    return HttpResponse.json(filtered)
  }),

  /**
   * POST /rest/v1/board - Create board
   */
  http.post(`${SUPABASE_URL}/rest/v1/board`, async ({ request }) => {
    const body = (await request.json()) as Partial<(typeof mockBoards)[0]>

    const newBoard = {
      id: `board-${Date.now()}`,
      name: body.name || 'New Board',
      user_id: body.user_id || MOCK_USER_ID,
      theme: body.theme || 'sunrise',
      settings: body.settings || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Check if Prefer header requests single item return
    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(newBoard, { status: 201 })
    }

    return HttpResponse.json([newBoard], { status: 201 })
  }),

  /**
   * PATCH /rest/v1/board - Update board
   */
  http.patch(`${SUPABASE_URL}/rest/v1/board`, async ({ request }) => {
    const body = (await request.json()) as Partial<(typeof mockBoards)[0]>
    const params = getSearchParams(request)

    // Find the board to update based on query params
    const filtered = filterByParams(mockBoards, params)
    if (filtered.length === 0) {
      return HttpResponse.json({ message: 'No rows found' }, { status: 404 })
    }

    const updatedBoard = {
      ...filtered[0],
      ...body,
      updated_at: new Date().toISOString(),
    }

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(updatedBoard)
    }

    return new HttpResponse(null, { status: 204 })
  }),

  /**
   * DELETE /rest/v1/board - Delete board
   */
  http.delete(`${SUPABASE_URL}/rest/v1/board`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // --------------------------------------------------------------------------
  // StatusList table handlers
  // --------------------------------------------------------------------------

  /**
   * GET /rest/v1/statuslist - List status lists
   */
  http.get(`${SUPABASE_URL}/rest/v1/statuslist`, ({ request }) => {
    const params = getSearchParams(request)
    const filtered = filterByParams(mockStatusLists, params)

    // Handle ordering
    const orderParam = params.get('order')
    if (orderParam) {
      // e.g., order=grid_row.asc,grid_col.asc
      const orders = orderParam.split(',')
      filtered.sort((a, b) => {
        for (const order of orders) {
          const [field, direction] = order.split('.')
          const aVal = a[field as keyof typeof a]
          const bVal = b[field as keyof typeof b]
          // Handle null values by treating them as lower than any other value
          if (aVal === null && bVal === null) continue
          if (aVal === null) return direction === 'desc' ? 1 : -1
          if (bVal === null) return direction === 'desc' ? -1 : 1
          if (aVal !== bVal) {
            const cmp = aVal < bVal ? -1 : 1
            return direction === 'desc' ? -cmp : cmp
          }
        }
        return 0
      })
    }

    return HttpResponse.json(filtered)
  }),

  /**
   * POST /rest/v1/statuslist - Create status list
   */
  http.post(`${SUPABASE_URL}/rest/v1/statuslist`, async ({ request }) => {
    const body = (await request.json()) as
      | Partial<(typeof mockStatusLists)[0]>
      | Array<Partial<(typeof mockStatusLists)[0]>>

    // Handle batch insert
    const items = Array.isArray(body) ? body : [body]

    const newStatusLists = items.map((item, index) => ({
      id: `status-new-${Date.now()}-${index}`,
      name: item.name || 'New Column',
      board_id: item.board_id || MOCK_BOARD_ID,
      color: item.color || '#6B7280',
      order: item.order ?? index,
      grid_row: item.grid_row ?? 0,
      grid_col: item.grid_col ?? index,
      wip_limit: item.wip_limit ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(
        Array.isArray(body) ? newStatusLists : newStatusLists[0],
        { status: 201 },
      )
    }

    return HttpResponse.json(newStatusLists, { status: 201 })
  }),

  /**
   * PATCH /rest/v1/statuslist - Update status list
   */
  http.patch(`${SUPABASE_URL}/rest/v1/statuslist`, async ({ request }) => {
    const body = (await request.json()) as Partial<(typeof mockStatusLists)[0]>
    const params = getSearchParams(request)

    const filtered = filterByParams(mockStatusLists, params)
    if (filtered.length === 0) {
      return HttpResponse.json({ message: 'No rows found' }, { status: 404 })
    }

    const updated = {
      ...filtered[0],
      ...body,
      updated_at: new Date().toISOString(),
    }

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(updated)
    }

    return new HttpResponse(null, { status: 204 })
  }),

  /**
   * DELETE /rest/v1/statuslist - Delete status list
   */
  http.delete(`${SUPABASE_URL}/rest/v1/statuslist`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // --------------------------------------------------------------------------
  // RepoCard table handlers
  // --------------------------------------------------------------------------

  /**
   * GET /rest/v1/repocard - List repo cards
   */
  http.get(`${SUPABASE_URL}/rest/v1/repocard`, ({ request }) => {
    const params = getSearchParams(request)
    const filtered = filterByParams(mockRepoCards, params)

    // Handle ordering
    const orderParam = params.get('order')
    if (orderParam) {
      const orders = orderParam.split(',')
      filtered.sort((a, b) => {
        for (const order of orders) {
          const [field, direction] = order.split('.')
          const aVal = a[field as keyof typeof a]
          const bVal = b[field as keyof typeof b]
          if (aVal !== bVal) {
            const cmp = (aVal as number) < (bVal as number) ? -1 : 1
            return direction === 'desc' ? -cmp : cmp
          }
        }
        return 0
      })
    }

    return HttpResponse.json(filtered)
  }),

  /**
   * POST /rest/v1/repocard - Create repo card
   */
  http.post(`${SUPABASE_URL}/rest/v1/repocard`, async ({ request }) => {
    const body = (await request.json()) as
      | Partial<(typeof mockRepoCards)[0]>
      | Array<Partial<(typeof mockRepoCards)[0]>>

    // Handle batch insert
    const items = Array.isArray(body) ? body : [body]

    const newCards = items.map((item, index) => ({
      id: `card-new-${Date.now()}-${index}`,
      board_id: item.board_id || MOCK_BOARD_ID,
      status_id: item.status_id || MOCK_STATUS_IDS.backlog,
      repo_owner: item.repo_owner || 'unknown',
      repo_name: item.repo_name || 'unknown-repo',
      note: item.note || '',
      order: item.order ?? index,
      meta: item.meta || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(Array.isArray(body) ? newCards : newCards[0], {
        status: 201,
      })
    }

    return HttpResponse.json(newCards, { status: 201 })
  }),

  /**
   * PATCH /rest/v1/repocard - Update repo card
   */
  http.patch(`${SUPABASE_URL}/rest/v1/repocard`, async ({ request }) => {
    const body = (await request.json()) as Partial<(typeof mockRepoCards)[0]>
    const params = getSearchParams(request)

    const filtered = filterByParams(mockRepoCards, params)
    if (filtered.length === 0) {
      return HttpResponse.json({ message: 'No rows found' }, { status: 404 })
    }

    const updated = {
      ...filtered[0],
      ...body,
      updated_at: new Date().toISOString(),
    }

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(updated)
    }

    return new HttpResponse(null, { status: 204 })
  }),

  /**
   * DELETE /rest/v1/repocard - Delete repo card
   */
  http.delete(`${SUPABASE_URL}/rest/v1/repocard`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // --------------------------------------------------------------------------
  // ProjectInfo table handlers
  // --------------------------------------------------------------------------

  /**
   * GET /rest/v1/projectinfo - List project info
   */
  http.get(`${SUPABASE_URL}/rest/v1/projectinfo`, ({ request }) => {
    const params = getSearchParams(request)

    const mockProjectInfo = [
      {
        id: 'projinfo-1',
        repo_card_id: MOCK_CARD_ID,
        quick_note: 'Important project notes here',
        links: [
          { title: 'Documentation', url: 'https://docs.example.com' },
          { title: 'Staging', url: 'https://staging.example.com' },
        ],
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ]

    const filtered = filterByParams(mockProjectInfo, params)
    return HttpResponse.json(filtered)
  }),

  /**
   * POST /rest/v1/projectinfo - Create project info
   */
  http.post(`${SUPABASE_URL}/rest/v1/projectinfo`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    const newProjectInfo = {
      id: `projinfo-${Date.now()}`,
      repo_card_id: body.repo_card_id || MOCK_CARD_ID,
      quick_note: body.quick_note || '',
      links: body.links || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(newProjectInfo, { status: 201 })
    }

    return HttpResponse.json([newProjectInfo], { status: 201 })
  }),

  /**
   * PATCH /rest/v1/projectinfo - Update project info
   */
  http.patch(`${SUPABASE_URL}/rest/v1/projectinfo`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    const updated = {
      id: 'projinfo-1',
      repo_card_id: MOCK_CARD_ID,
      quick_note: body.quick_note || 'Updated notes',
      links: body.links || [],
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: new Date().toISOString(),
    }

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(updated)
    }

    return new HttpResponse(null, { status: 204 })
  }),

  /**
   * DELETE /rest/v1/projectinfo - Delete project info
   */
  http.delete(`${SUPABASE_URL}/rest/v1/projectinfo`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // --------------------------------------------------------------------------
  // AuditLog table handlers (insert-only)
  // --------------------------------------------------------------------------

  /**
   * POST /rest/v1/auditlog - Create audit log entry
   */
  http.post(`${SUPABASE_URL}/rest/v1/auditlog`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    const newLog = {
      id: `audit-${Date.now()}`,
      user_id: body.user_id || MOCK_USER_ID,
      action: body.action || 'unknown_action',
      resource_type: body.resource_type || 'board',
      resource_id: body.resource_id || MOCK_BOARD_ID,
      success: body.success ?? true,
      ip_address: body.ip_address || '127.0.0.1',
      user_agent: body.user_agent || 'MSW Mock',
      created_at: new Date().toISOString(),
    }

    return HttpResponse.json([newLog], { status: 201 })
  }),
]

// ============================================================================
// GitHub API Handlers
// ============================================================================

const githubApiHandlers: HttpHandler[] = [
  /**
   * GET /user - Get authenticated GitHub user
   */
  http.get(`${GITHUB_API_URL}/user`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    return HttpResponse.json(mockGitHubUser)
  }),

  /**
   * GET /user/repos - Get authenticated user's repositories
   */
  http.get(`${GITHUB_API_URL}/user/repos`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    const params = getSearchParams(request)
    const sort = params.get('sort') || 'updated'
    const perPage = parseInt(params.get('per_page') || '30', 10)
    const page = parseInt(params.get('page') || '1', 10)

    let repos = [...mockGitHubRepos]

    // Sort repositories
    if (sort === 'updated') {
      repos.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
    } else if (sort === 'created') {
      repos.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    } else if (sort === 'pushed') {
      repos.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
    } else if (sort === 'full_name') {
      repos.sort((a, b) => a.full_name.localeCompare(b.full_name))
    }

    // Paginate
    const start = (page - 1) * perPage
    repos = repos.slice(start, start + perPage)

    return HttpResponse.json(repos)
  }),

  /**
   * GET /user/orgs - Get authenticated user's organizations
   */
  http.get(`${GITHUB_API_URL}/user/orgs`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    return HttpResponse.json(mockGitHubOrgs)
  }),

  /**
   * GET /repos/:owner/:repo - Get a specific repository
   */
  http.get(`${GITHUB_API_URL}/repos/:owner/:repo`, ({ params, request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    const { owner, repo } = params
    const fullName = `${owner}/${repo}`

    const foundRepo = mockGitHubRepos.find((r) => r.full_name === fullName)

    if (!foundRepo) {
      return HttpResponse.json({ message: 'Not Found' }, { status: 404 })
    }

    return HttpResponse.json(foundRepo)
  }),

  /**
   * GET /search/repositories - Search repositories
   */
  http.get(`${GITHUB_API_URL}/search/repositories`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Requires authentication' },
        { status: 401 },
      )
    }

    const params = getSearchParams(request)
    const query = params.get('q') || ''

    // Simple search filter
    const items = mockGitHubRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        (repo.description?.toLowerCase().includes(query.toLowerCase()) ??
          false),
    )

    return HttpResponse.json({
      total_count: items.length,
      incomplete_results: false,
      items,
    })
  }),
]

// ============================================================================
// Export All Handlers
// ============================================================================

/**
 * Combined array of all MSW request handlers
 * Used by Storybook and tests to mock API requests
 */
export const handlers: HttpHandler[] = [
  ...supabaseAuthHandlers,
  ...supabaseDbHandlers,
  ...githubApiHandlers,
]

// ============================================================================
// Exported Mock Data (for use in tests/stories)
// ============================================================================

export const mockData = {
  user: mockUser,
  session: mockSession,
  boards: mockBoards,
  statusLists: mockStatusLists,
  repoCards: mockRepoCards,
  gitHubUser: mockGitHubUser,
  gitHubRepos: mockGitHubRepos,
  gitHubOrgs: mockGitHubOrgs,
  ids: {
    userId: MOCK_USER_ID,
    boardId: MOCK_BOARD_ID,
    statusIds: MOCK_STATUS_IDS,
    cardId: MOCK_CARD_ID,
  },
} as const

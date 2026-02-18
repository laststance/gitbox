/**
 * Supabase Mock Handlers
 *
 * MSW handlers for Supabase Auth and Database (PostgREST) endpoints.
 * Provides mock data for authentication, boards, status lists, repo cards, and more.
 *
 * @see https://supabase.com/docs/reference/javascript/auth-api
 * @see https://postgrest.org/en/stable/api.html
 */
import { http, HttpResponse, type HttpHandler } from 'msw'

import {
  SUPABASE_URL,
  MOCK_USER_ID,
  MOCK_BOARD_ID,
  MOCK_STATUS_IDS,
  MOCK_CARD_ID,
  mockUser,
  mockSession,
  mockBoards,
  mockStatusLists,
  mockRepoCards,
  mockProjectInfo,
  mockMaintenance,
  mockMaintenanceProjectInfo,
  mockUserSettings,
  getSearchParams,
  filterByParams,
  updateMockBoard,
} from './data'

// ============================================================================
// Supabase Auth Handlers
// ============================================================================

export const supabaseAuthHandlers: HttpHandler[] = [
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

export const supabaseDbHandlers: HttpHandler[] = [
  // --------------------------------------------------------------------------
  // Board table handlers
  // --------------------------------------------------------------------------

  /**
   * GET /rest/v1/board - List boards
   *
   * Handles both array and single object responses based on Accept header.
   * Supabase `.single()` sets Accept: application/vnd.pgrst.object+json
   */
  http.get(`${SUPABASE_URL}/rest/v1/board`, ({ request }) => {
    const params = getSearchParams(request)
    const filtered = filterByParams(mockBoards, params)

    // Handle select parameter for partial data
    const selectParam = params.get('select')
    if (selectParam === 'id, name') {
      const mapped = filtered.map((b) => ({ id: b.id, name: b.name }))
      // Check if .single() was requested
      const acceptHeader = request.headers.get('Accept') || ''
      if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
        return HttpResponse.json(mapped[0] || null)
      }
      return HttpResponse.json(mapped)
    }

    // Check if .single() was requested (Supabase client sets this header)
    const acceptHeader = request.headers.get('Accept') || ''
    if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
      // Return single object for .single() calls
      return HttpResponse.json(filtered[0] || null)
    }

    return HttpResponse.json(filtered)
  }),

  /**
   * POST /rest/v1/board - Create board
   */
  http.post(`${SUPABASE_URL}/rest/v1/board`, async ({ request }) => {
    const body = (await request.json()) as Partial<(typeof mockBoards)[number]>

    const newBoard = {
      id: `board-${Date.now()}`,
      name: body.name || 'New Board',
      user_id: body.user_id || MOCK_USER_ID,
      theme: body.theme || 'default',
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
   *
   * Persists changes to mockBoards array for state consistency in tests.
   */
  http.patch(`${SUPABASE_URL}/rest/v1/board`, async ({ request }) => {
    const body = (await request.json()) as Partial<(typeof mockBoards)[number]>
    const params = getSearchParams(request)

    // Find the board to update based on query params
    const filtered = filterByParams(mockBoards, params)
    if (filtered.length === 0) {
      return HttpResponse.json({ message: 'No rows found' }, { status: 404 })
    }

    // Use helper function to update mock data
    const firstBoard = filtered[0]
    if (!firstBoard) {
      return HttpResponse.json({ message: 'No rows found' }, { status: 404 })
    }
    const updatedBoard = updateMockBoard(firstBoard.id, body)
    if (!updatedBoard) {
      return HttpResponse.json({ message: 'No rows found' }, { status: 404 })
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
   *
   * Supports filtering by repo_card_id for batch comment fetching.
   * Also supports Supabase "in" filter for multiple IDs.
   * Supports filtering by maintenance_id for maintenance page.
   */
  http.get(`${SUPABASE_URL}/rest/v1/projectinfo`, ({ request }) => {
    const params = getSearchParams(request)

    // Handle Supabase "in" filter for batch fetching (e.g., repo_card_id=in.(card-1,card-2))
    const repoCardIdParam = params.get('repo_card_id')
    if (repoCardIdParam?.startsWith('in.(')) {
      const idsMatch = repoCardIdParam.match(/in\.\((.+)\)/)
      if (idsMatch?.[1]) {
        const ids = idsMatch[1].split(',')
        const filtered = mockProjectInfo.filter((p) =>
          ids.includes(p.repo_card_id),
        )
        return HttpResponse.json(filtered)
      }
    }

    // Handle maintenance_id filter for maintenance page
    const maintenanceIdParam = params.get('maintenance_id')
    if (maintenanceIdParam?.startsWith('eq.')) {
      const maintenanceId = maintenanceIdParam.slice(3)
      const filtered = mockMaintenanceProjectInfo.filter(
        (p) => p.maintenance_id === maintenanceId,
      )

      // Check if .single() was requested
      const acceptHeader = request.headers.get('Accept') || ''
      if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
        return HttpResponse.json(filtered[0] || null)
      }
      return HttpResponse.json(filtered)
    }

    // Standard PostgREST filter
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
      note: body.note || '',
      comment: body.comment || '',
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
      note: body.note || 'Updated notes',
      comment: body.comment || 'Updated comment',
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
  // Maintenance table handlers
  // --------------------------------------------------------------------------

  /**
   * GET /rest/v1/maintenance - List maintenance items
   */
  http.get(`${SUPABASE_URL}/rest/v1/maintenance`, ({ request }) => {
    const params = getSearchParams(request)
    const filtered = filterByParams(mockMaintenance, params)

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
            const cmp = (aVal as string) < (bVal as string) ? -1 : 1
            return direction === 'desc' ? -cmp : cmp
          }
        }
        return 0
      })
    }

    // Check if .single() was requested
    const acceptHeader = request.headers.get('Accept') || ''
    if (acceptHeader.includes('application/vnd.pgrst.object+json')) {
      return HttpResponse.json(filtered[0] || null)
    }

    return HttpResponse.json(filtered)
  }),

  /**
   * POST /rest/v1/maintenance - Create maintenance item
   */
  http.post(`${SUPABASE_URL}/rest/v1/maintenance`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    const newMaintenance = {
      id: `maintenance-${Date.now()}`,
      user_id: body.user_id || MOCK_USER_ID,
      repo_owner: body.repo_owner || 'unknown',
      repo_name: body.repo_name || 'unknown-repo',
      repo_card_id: body.repo_card_id || null,
      note: body.note || '',
      hidden: body.hidden ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(newMaintenance, { status: 201 })
    }

    return HttpResponse.json([newMaintenance], { status: 201 })
  }),

  /**
   * PATCH /rest/v1/maintenance - Update maintenance item
   */
  http.patch(`${SUPABASE_URL}/rest/v1/maintenance`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const params = getSearchParams(request)

    const filtered = filterByParams(mockMaintenance, params)
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
   * DELETE /rest/v1/maintenance - Delete maintenance item
   */
  http.delete(`${SUPABASE_URL}/rest/v1/maintenance`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // --------------------------------------------------------------------------
  // User Settings table handlers
  // --------------------------------------------------------------------------

  /**
   * GET /rest/v1/user_settings - Get user settings
   *
   * Supports .maybeSingle() (returns object or null via Accept header).
   */
  http.get(`${SUPABASE_URL}/rest/v1/user_settings`, () => {
    // .maybeSingle() sets this Accept header
    return HttpResponse.json(mockUserSettings)
  }),

  /**
   * POST /rest/v1/user_settings - Upsert user settings
   *
   * Supabase upsert uses POST with Prefer: resolution=merge-duplicates.
   */
  http.post(`${SUPABASE_URL}/rest/v1/user_settings`, async ({ request }) => {
    const body = (await request.json()) as Partial<typeof mockUserSettings>

    // Merge into mock data
    if (body.boards_page_title !== undefined) {
      mockUserSettings.boards_page_title = body.boards_page_title
    }
    if (body.boards_page_subtitle !== undefined) {
      mockUserSettings.boards_page_subtitle = body.boards_page_subtitle
    }
    mockUserSettings.updated_at = new Date().toISOString()

    const preferHeader = request.headers.get('Prefer')
    if (preferHeader?.includes('return=representation')) {
      return HttpResponse.json(mockUserSettings, { status: 201 })
    }

    return new HttpResponse(null, { status: 201 })
  }),
]

// ============================================================================
// Combined Supabase Handlers
// ============================================================================

export const supabaseHandlers: HttpHandler[] = [
  ...supabaseAuthHandlers,
  ...supabaseDbHandlers,
]

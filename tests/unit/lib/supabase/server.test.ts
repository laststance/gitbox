/**
 * Supabase Server Client Tests
 *
 * T028.2: Unit test for Supabase server client initialization
 * - Server Components 用クライアントの作成
 * - Route Handler 用クライアントの作成
 * - Server Action 用クライアントの作成
 * - Cookie 操作の検証
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createServerClient } from '@supabase/ssr'

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  })),
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => ({ value: `mock-${name}` })),
    set: vi.fn(),
  })),
}))

describe('Supabase Server Client (lib/supabase/server.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createClient (Server Component)', () => {
    it('should create server client with cookie handlers', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const client = createClient()

      expect(createServerClient).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        expect.objectContaining({
          cookies: expect.objectContaining({
            get: expect.any(Function),
            set: expect.any(Function),
            remove: expect.any(Function),
          }),
        })
      )

      expect(client).toBeDefined()
      expect(client.auth).toBeDefined()
    })

    it('should handle cookie get operation', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      createClient()

      const cookieConfig = vi.mocked(createServerClient).mock.calls[0][2]
      const cookieValue = cookieConfig?.cookies?.get('test-cookie')

      expect(cookieValue).toBeDefined()
    })

    it('should handle cookie set operation gracefully', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      createClient()

      const cookieConfig = vi.mocked(createServerClient).mock.calls[0][2]

      // Should not throw even if set fails in Server Component
      expect(() => {
        cookieConfig?.cookies?.set('test', 'value', {})
      }).not.toThrow()
    })

    it('should handle cookie remove operation gracefully', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      createClient()

      const cookieConfig = vi.mocked(createServerClient).mock.calls[0][2]

      // Should not throw even if remove fails in Server Component
      expect(() => {
        cookieConfig?.cookies?.remove('test', {})
      }).not.toThrow()
    })
  })

  describe('createRouteHandlerClient', () => {
    it('should create client with Route Handler cookie handlers', async () => {
      const mockRequest = new Request('http://localhost:3000')

      const { createRouteHandlerClient } = await import('@/lib/supabase/server')
      const client = createRouteHandlerClient(mockRequest)

      expect(createServerClient).toHaveBeenCalled()
      expect(client).toBeDefined()
    })
  })

  describe('createServerActionClient', () => {
    it('should create client with Server Action cookie handlers', async () => {
      const { createServerActionClient } = await import(
        '@/lib/supabase/server'
      )
      const client = createServerActionClient()

      expect(createServerClient).toHaveBeenCalled()
      expect(client).toBeDefined()
    })
  })

  describe('Server-side getUser', () => {
    it('should get user successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      }

      vi.mocked(createServerClient).mockReturnValue(mockClient as any)

      const { getUser } = await import('@/lib/supabase/server')
      const user = await getUser()

      expect(user).toEqual(mockUser)
    })

    it('should handle error and return null', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'User error' },
          }),
        },
      }

      vi.mocked(createServerClient).mockReturnValue(mockClient as any)

      const { getUser } = await import('@/lib/supabase/server')
      const user = await getUser()

      expect(user).toBeNull()
    })
  })

  describe('Server-side getSession', () => {
    it('should get session successfully', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token',
      }

      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null,
          }),
        },
      }

      vi.mocked(createServerClient).mockReturnValue(mockClient as any)

      const { getSession } = await import('@/lib/supabase/server')
      const session = await getSession()

      expect(session).toEqual(mockSession)
    })

    it('should handle error and return null', async () => {
      const mockClient = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: { message: 'Session error' },
          }),
        },
      }

      vi.mocked(createServerClient).mockReturnValue(mockClient as any)

      const { getSession } = await import('@/lib/supabase/server')
      const session = await getSession()

      expect(session).toBeNull()
    })
  })
})

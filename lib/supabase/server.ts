/**
 * Supabase Server Client
 *
 * Supabase client for use in Server Components, Server Actions, and Route Handlers
 * Implements cookie-based authentication using @supabase/ssr
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from './types'

/**
 * Check if E2E test mode is enabled
 * When true, auth checks return mock data to bypass OAuth
 *
 * NOTE: Uses APP_ENV (server-side) instead of NEXT_PUBLIC_ENABLE_MSW_MOCK
 * because NEXT_PUBLIC_* vars are inlined at build time and may not be
 * available at runtime on the server.
 */
const isE2ETestMode = () =>
  process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test'

/**
 * Create Supabase client for use in Server Components
 *
 * @example
 * ```tsx
 * import { createClient } from '@/lib/supabase/server'
 *
 * export default async function Page() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('Board').select('*')
 *   return <div>{data}</div>
 * }
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // set doesn't work in Server Components - ignored
            // Will be handled by middleware.ts or Route Handler
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // remove doesn't work in Server Components - ignored
          }
        },
      },
    },
  )

  // In E2E test mode, wrap auth methods to return mock data
  const testMode = isE2ETestMode()
  if (testMode) {
    // Use a Proxy to intercept auth methods while preserving all other client functionality
    const mockedAuth = {
      getUser: async () => ({
        data: { user: MOCK_USER_FOR_E2E },
        error: null,
      }),
      getSession: async () => ({
        data: {
          session: {
            access_token: 'mock-access-token-for-testing',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'mock-refresh-token-for-testing',
            user: MOCK_USER_FOR_E2E,
          },
        },
        error: null,
      }),
    }

    return new Proxy(supabase, {
      get(target, prop) {
        if (prop === 'auth') {
          // Return a proxy for auth that intercepts getUser/getSession
          return new Proxy(target.auth, {
            get(authTarget, authProp) {
              if (authProp === 'getUser') return mockedAuth.getUser
              if (authProp === 'getSession') return mockedAuth.getSession
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (authTarget as any)[authProp]
            },
          })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (target as any)[prop]
      },
    }) as typeof supabase
  }

  return supabase
}

/**
 * Create Supabase client for use in Route Handlers
 *
 * @example
 * ```tsx
 * import { createRouteHandlerClient } from '@/lib/supabase/server'
 * import { NextResponse } from 'next/server'
 *
 * export async function GET(request: Request) {
 *   const supabase = await createRouteHandlerClient(request)
 *   const { data } = await supabase.from('Board').select('*')
 *   return NextResponse.json(data)
 * }
 * ```
 */
export async function createRouteHandlerClient(_request: Request) {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    },
  )
}

/**
 * Create Supabase client for use in Server Actions
 *
 * @example
 * ```tsx
 * 'use server'
 *
 * import { createServerActionClient } from '@/lib/supabase/server'
 *
 * export async function createBoard(name: string) {
 *   const supabase = await createServerActionClient()
 *   const { data, error } = await supabase
 *     .from('Board')
 *     .insert({ name })
 *     .select()
 *     .single()
 *
 *   if (error) throw error
 *   return data
 * }
 * ```
 */
export async function createServerActionClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    },
  )
}

/**
 * Mock user for E2E testing when MSW is enabled
 */
const MOCK_USER_FOR_E2E = {
  id: 'test-user-id-12345',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  phone: '',
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'github', providers: ['github'] },
  user_metadata: {
    avatar_url: 'https://avatars.githubusercontent.com/u/12345',
    full_name: 'Test User',
    preferred_username: 'testuser',
    user_name: 'testuser',
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
} as const

/**
 * Get current user (server-side)
 *
 * In E2E test mode (NEXT_PUBLIC_ENABLE_MSW_MOCK=true + APP_ENV=test),
 * returns a mock user to bypass OAuth flow.
 */
export async function getUser() {
  // E2E test mode: return mock user to bypass OAuth
  const isMSWEnabled =
    process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true' &&
    (process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test')

  if (isMSWEnabled) {
    return MOCK_USER_FOR_E2E
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error('Failed to get user:', error)
    return null
  }

  return user
}

/**
 * Get current session (server-side)
 *
 * In E2E test mode (NEXT_PUBLIC_ENABLE_MSW_MOCK=true + APP_ENV=test),
 * returns a mock session to bypass OAuth flow.
 */
export async function getSession() {
  // E2E test mode: return mock session to bypass OAuth
  const isMSWEnabled =
    process.env.NEXT_PUBLIC_ENABLE_MSW_MOCK === 'true' &&
    (process.env.APP_ENV === 'test' || process.env.NODE_ENV === 'test')

  if (isMSWEnabled) {
    return {
      access_token: 'mock-access-token-for-testing',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'mock-refresh-token-for-testing',
      user: MOCK_USER_FOR_E2E,
    }
  }

  const supabase = await createClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error('Failed to get session:', error)
    return null
  }

  return session
}

/**
 * Supabase Server Client
 *
 * Supabase client for use in Server Components, Server Actions, and Route Handlers
 * Implements cookie-based authentication using @supabase/ssr
 */

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { destr } from 'destr'
import { cookies } from 'next/headers'

import type { Database } from './types'

/**
 * Get the Supabase URL, preferring runtime SUPABASE_URL over build-time NEXT_PUBLIC_SUPABASE_URL.
 *
 * NEXT_PUBLIC_* vars are inlined at build time by Next.js, so they can't be
 * overridden per-process at runtime. For E2E parallel shards, each Next.js
 * server needs its own PostgREST URL — SUPABASE_URL provides this.
 *
 * @returns Runtime SUPABASE_URL if set, otherwise build-time NEXT_PUBLIC_SUPABASE_URL
 */
const getSupabaseUrl = () =>
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

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
 * Pre-computed JWT for E2E test mode.
 *
 * Signed with the well-known local Supabase JWT secret:
 *   "super-secret-jwt-token-with-at-least-32-characters-long"
 *
 * Claims: iss=supabase-demo, role=authenticated,
 *   sub=00000000-0000-0000-0000-000000000001, aud=authenticated, exp=2032
 *
 * PostgREST validates this JWT and sets:
 *   - role = 'authenticated' (PostgreSQL role switch)
 *   - auth.uid() = sub claim (for RLS policy evaluation)
 *
 * @see https://supabase.com/docs/guides/database/postgres/row-level-security
 */
const E2E_TEST_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxOTgzODEyOTk2fQ.iUckNAR3RMWPmn8smgOZr0NeDUzRLR0LOx_5V1ddQVs'

/**
 * Create Supabase client for use in Server Components
 *
 * Uses getAll/setAll pattern required for PKCE flow support.
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
  const testMode = isE2ETestMode()

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * Get all cookies for PKCE flow support.
         *
         * In E2E test mode, replaces the mock access_token in the Supabase
         * auth cookie with a valid JWT so PostgREST can set auth.uid() for RLS.
         */
        getAll() {
          const allCookies = cookieStore.getAll()
          if (!testMode) return allCookies

          return allCookies.map((cookie) => {
            if (
              cookie.name.startsWith('sb-') &&
              cookie.name.endsWith('-auth-token')
            ) {
              const session = destr<Record<string, unknown>>(cookie.value)
              if (typeof session === 'object' && session !== null) {
                session.access_token = E2E_TEST_JWT
                return { ...cookie, value: JSON.stringify(session) }
              }
              return cookie
            }
            return cookie
          })
        },
        /**
         * Set all cookies for PKCE flow support.
         * Wrapped in try-catch because Server Components cannot write cookies.
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll doesn't work in Server Components - ignored
            // Will be handled by proxy.ts or Route Handler
          }
        },
      },
    },
  )

  // In E2E test mode, wrap auth methods to return mock data
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
            access_token: E2E_TEST_JWT,
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
 * Uses getAll/setAll pattern required for PKCE flow support.
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
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

/**
 * Create Supabase client for use in Server Actions
 *
 * Uses getAll/setAll pattern required for PKCE flow support.
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
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

/**
 * Mock user for E2E testing when MSW is enabled
 */
const MOCK_USER_FOR_E2E = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@gitbox.dev',
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
 * Create Supabase Admin Client with Service Role Key
 *
 * This client bypasses Row Level Security (RLS) and should only be used
 * for administrative operations like user deletion.
 *
 * @warning NEVER use this client for regular operations - only for admin tasks
 * @returns Supabase client with admin privileges
 *
 * @example
 * ```tsx
 * import { createAdminClient } from '@/lib/supabase/server'
 *
 * async function deleteUser(userId: string) {
 *   const adminClient = createAdminClient()
 *   await adminClient.auth.admin.deleteUser(userId)
 * }
 * ```
 */
export function createAdminClient() {
  const supabaseUrl = getSupabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL',
    )
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

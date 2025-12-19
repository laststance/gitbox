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

  return createServerClient<Database>(
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
 * Get current user (server-side)
 */
export async function getUser() {
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
 */
export async function getSession() {
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

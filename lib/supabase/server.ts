/**
 * Supabase Server Client
 *
 * Server Components, Server Actions, Route Handlers で使用する Supabase クライアント
 * @supabase/ssr を使用してクッキーベースの認証を実現
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Server Component で使用する Supabase クライアントを作成
 *
 * @example
 * ```tsx
 * import { createClient } from '@/lib/supabase/server'
 *
 * export default async function Page() {
 *   const supabase = createClient()
 *   const { data } = await supabase.from('Board').select('*')
 *   return <div>{data}</div>
 * }
 * ```
 */
export function createClient() {
  const cookieStore = cookies()

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
          } catch (error) {
            // Server Component では set は動作しないため、無視
            // middleware.ts や Route Handler で処理される
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Server Component では remove は動作しないため、無視
          }
        },
      },
    }
  )
}

/**
 * Route Handler で使用する Supabase クライアントを作成
 *
 * @example
 * ```tsx
 * import { createRouteHandlerClient } from '@/lib/supabase/server'
 * import { NextResponse } from 'next/server'
 *
 * export async function GET(request: Request) {
 *   const supabase = createRouteHandlerClient(request)
 *   const { data } = await supabase.from('Board').select('*')
 *   return NextResponse.json(data)
 * }
 * ```
 */
export function createRouteHandlerClient(request: Request) {
  const cookieStore = cookies()

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
    }
  )
}

/**
 * Server Action で使用する Supabase クライアントを作成
 *
 * @example
 * ```tsx
 * 'use server'
 *
 * import { createServerActionClient } from '@/lib/supabase/server'
 *
 * export async function createBoard(name: string) {
 *   const supabase = createServerActionClient()
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
export function createServerActionClient() {
  const cookieStore = cookies()

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
    }
  )
}

/**
 * 現在のユーザーを取得（サーバーサイド）
 */
export async function getUser() {
  const supabase = createClient()
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
 * 現在のセッションを取得（サーバーサイド）
 */
export async function getSession() {
  const supabase = createClient()
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

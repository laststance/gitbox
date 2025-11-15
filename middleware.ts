/**
 * Next.js Middleware
 *
 * 認証チェックとロケールルーティング
 * - Supabase セッション検証
 * - next-intl ロケール処理
 * - 認証が必要なルートの保護
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// 認証不要なパス
const publicPaths = ['/', '/auth/callback']

// next-intl のミドルウェア
const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Supabase クライアントを作成（Cookie 操作付き）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // セッションを取得
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // パスのチェック
  const { pathname } = request.nextUrl

  // ロケールを除去したパス
  const pathnameWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'

  // 認証不要なパスの場合は next-intl ミドルウェアのみ適用
  if (publicPaths.includes(pathnameWithoutLocale)) {
    return intlMiddleware(request)
  }

  // 認証が必要なパスで未認証の場合はログインページにリダイレクト
  if (!session) {
    const locale = request.nextUrl.pathname.split('/')[1]
    const loginUrl = new URL(`/${locale}/login`, request.url)
    return NextResponse.redirect(loginUrl)
  }

  // next-intl ミドルウェアを適用
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    /*
     * 以下を除く全てのパスにマッチ:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

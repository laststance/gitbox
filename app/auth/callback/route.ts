/**
 * OAuth Callback Handler
 *
 * GitHub OAuth の認証コールバックを処理
 * - 認証コードを取得してセッションを確立
 * - エラーハンドリング
 * - Boards 画面へリダイレクト
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/boards' // ログイン後は Boards 画面へリダイレクト

  if (code) {
    const supabase = await createClient()

    try {
      // 認証コードを使用してセッションを確立
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth callback error:', error)
        return NextResponse.redirect(
          `${origin}/login?error=auth_failed&message=${encodeURIComponent(error.message)}`
        )
      }

      // セッション確立成功 - Boards 画面にリダイレクト
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // ローカル環境では localhost にリダイレクト
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        // 本番環境では x-forwarded-host を使用
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        // fallback
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (error) {
      console.error('Unexpected error in OAuth callback:', error)
      return NextResponse.redirect(
        `${origin}/login?error=unexpected_error`
      )
    }
  }

  // code パラメータがない場合はログインページにリダイレクト
  return NextResponse.redirect(
    `${origin}/login?error=missing_code`
  )
}
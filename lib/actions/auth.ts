/**
 * Authentication Actions
 *
 * サーバーアクションで認証処理を実行
 * - GitHub OAuth サインイン
 * - サインアウト
 * - セッション管理
 */

'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * GitHub OAuth でサインイン
 *
 * @returns リダイレクト先 URL（GitHub 認証画面）
 */
export async function signInWithGitHub() {
  const supabase = await createClient()
  const origin =
    (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: 'read:user user:email repo', // GitHub Repository アクセスに必要なスコープ
    },
  })

  if (error) {
    console.error('GitHub OAuth sign in error:', error)
    redirect(
      `/login?error=oauth_failed&message=${encodeURIComponent(error.message)}`,
    )
  }

  if (data.url) {
    redirect(data.url)
  }
}

/**
 * サインアウト
 *
 * - Supabase セッションを削除
 * - ログインページにリダイレクト
 */
export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Sign out error:', error)
    throw new Error(error.message)
  }

  redirect('/login')
}

/**
 * 現在のユーザーセッションを取得
 *
 * @returns セッション情報（未認証の場合は null）
 */
export async function getSession() {
  const supabase = await createClient()

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error('Get session error:', error)
    return null
  }

  return session
}

/**
 * 現在のユーザー情報を取得
 *
 * @returns ユーザー情報（未認証の場合は null）
 */
export async function getUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error('Get user error:', error)
    return null
  }

  return user
}

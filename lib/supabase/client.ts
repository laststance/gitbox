/**
 * Supabase Client (Browser)
 *
 * クライアントサイドで使用する Supabase クライアント
 * ブラウザ環境での認証とデータベース操作に使用
 */

import { createClient, type Session } from '@supabase/supabase-js'

import type { Database } from './types'

// 環境変数の検証
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Supabase クライアントのシングルトンインスタンス
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // GitHub OAuth に推奨
  },
})

/**
 * 現在のユーザーセッションを取得
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Failed to get session:', error)
    return null
  }
  return data.session
}

/**
 * 現在のユーザー情報を取得
 */
export async function getUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Failed to get user:', error)
    return null
  }
  return data.user
}

/**
 * GitHub OAuth でサインイン
 */
export async function signInWithGitHub(redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
      scopes: 'read:user user:email',
    },
  })

  if (error) {
    console.error('Failed to sign in with GitHub:', error)
    throw error
  }

  return data
}

/**
 * サインアウト
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Failed to sign out:', error)
    throw error
  }
}

/**
 * 認証状態の変更を監視
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback)
}

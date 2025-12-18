/**
 * Board Layout
 *
 * レイアウト for /board/* routes
 * - Sidebar ナビゲーション
 * - ユーザー情報を取得して Sidebar に渡す
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BoardLayoutClient } from './BoardLayoutClient'

export default async function BoardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user metadata
  const userName = user.user_metadata?.full_name || user.email || 'User'
  const userAvatar = user.user_metadata?.avatar_url

  return (
    <BoardLayoutClient userName={userName} userAvatar={userAvatar}>
      {children}
    </BoardLayoutClient>
  )
}

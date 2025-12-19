/**
 * Board Layout
 *
 * Layout for /board/* routes
 * - Sidebar navigation
 * - Fetches user information and passes it to Sidebar
 */

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

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

/**
 * Account Page
 *
 * User account management page
 * - Profile information
 * - Account data summary (boards, cards, maintenance items)
 * - Danger zone (account deletion)
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { AccountClient } from './AccountClient'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Manage your GitBox account settings',
}

export interface AccountData {
  boardsCount: number
  cardsCount: number
  maintenanceCount: number
}

export interface UserProfile {
  id: string
  userName: string
  userAvatar?: string
  linkedSince: string
}

export default async function AccountPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch account data counts in parallel
  const [boardsResult, cardsResult, maintenanceResult] = await Promise.all([
    supabase
      .from('board')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('repocard')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('maintenance')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const accountData: AccountData = {
    boardsCount: boardsResult.count ?? 0,
    cardsCount: cardsResult.count ?? 0,
    maintenanceCount: maintenanceResult.count ?? 0,
  }

  const userProfile: UserProfile = {
    id: user.id,
    userName:
      user.user_metadata?.user_name ||
      user.user_metadata?.preferred_username ||
      user.email ||
      'User',
    userAvatar: user.user_metadata?.avatar_url,
    linkedSince: user.created_at,
  }

  return <AccountClient userProfile={userProfile} accountData={accountData} />
}

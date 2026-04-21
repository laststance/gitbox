/**
 * Account Page
 *
 * User account management page
 * - Profile information
 * - Account data summary (boards, cards, maintenance items)
 * - Danger zone (account deletion)
 */

import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth/require-user'
import { toUserId, type UserId } from '@/lib/types/brands'
import type {
  AvatarUrl,
  GitHubLogin,
  ISOTimestamp,
} from '@/lib/types/domain-primitives'

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
  id: UserId
  userName: GitHubLogin
  userAvatar?: AvatarUrl
  linkedSince: ISOTimestamp
}

export default async function AccountPage() {
  const { supabase, user } = await requireUser()

  // Fetch account data counts in parallel
  const [boardsResult, cardsResult, maintenanceResult] = await Promise.all([
    supabase
      .from('board')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('repocard')
      .select('id, board!inner()', { count: 'exact', head: true })
      .eq('board.user_id', user.id),
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
    id: toUserId(user.id),
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

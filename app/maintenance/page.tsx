/**
 * Maintenance Mode Page
 *
 * PRD 3.3: 完了・保守中のプロジェクト保管庫
 * - Explorer UI (Grid/List切替)
 * - 並び替え/検索
 * - クリック = GitHub repo へ遷移
 * - Restore to Board 操作
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MaintenanceClient, type MaintenanceRepo } from './MaintenanceClient'

export default async function MaintenancePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch maintenance repos from the maintenance table
  const { data: maintenanceData, error } = await supabase
    .from('maintenance')
    .select('*')
    .eq('user_id', user.id)
    .eq('hidden', false)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch maintenance repos:', error)
  }

  // Map maintenance data to MaintenanceRepo format
  const repos: MaintenanceRepo[] = (maintenanceData || []).map((item) => ({
    id: item.id,
    repo_owner: item.repo_owner,
    repo_name: item.repo_name,
    note: item.note,
    meta: null, // Maintenance table doesn't have meta
    created_at: item.created_at,
    updated_at: item.updated_at,
    board: null,
  }))

  return <MaintenanceClient repos={repos} />
}

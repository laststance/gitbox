/**
 * Maintenance Mode Page
 *
 * PRD 3.3: Repository for completed and maintenance projects
 * - Explorer UI (Grid/List toggle)
 * - Sorting/Search
 * - Click to navigate to GitHub repo
 * - Restore to Board operation
 */

import type { Metadata } from 'next'

import { requireClaims } from '@/lib/auth/require-claims'
import { createModuleLogger } from '@/lib/logger'
import { toMaintenanceId } from '@/lib/types/brands'

import { MaintenanceClient, type MaintenanceRepo } from './MaintenanceClient'

export const metadata: Metadata = {
  title: 'Maintenance',
  description: 'Repository for completed and maintenance projects',
}

const log = createModuleLogger('maintenance')

export default async function MaintenancePage() {
  const { supabase, claims } = await requireClaims()

  // Fetch maintenance repos from the maintenance table
  const { data: maintenanceData, error } = await supabase
    .from('maintenance')
    .select('*')
    .eq('user_id', claims.sub)
    .order('updated_at', { ascending: false })

  if (error) {
    log.error({ error }, 'Failed to fetch maintenance repos')
  }

  // Map maintenance data to MaintenanceRepo format
  const repos: MaintenanceRepo[] = (maintenanceData || []).map((item) => ({
    id: toMaintenanceId(item.id),
    repo_owner: item.repo_owner,
    repo_name: item.repo_name,
    meta: null, // Maintenance table doesn't have meta
    created_at: item.created_at,
    updated_at: item.updated_at,
    board: null,
  }))

  return <MaintenanceClient repos={repos} />
}

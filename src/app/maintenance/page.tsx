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

import type { CommentData } from '@/lib/actions/shared-project-info'
import { requireClaims } from '@/lib/auth/require-claims'
import { createModuleLogger } from '@/lib/logger'
import type { Tables } from '@/lib/supabase/database.types'
import type { CommentColor } from '@/lib/supabase/types'
import { toMaintenanceId } from '@/lib/types/brands'
import { DEFAULT_COMMENT_COLOR } from '@/lib/validations/project-info'

import { MaintenanceClient, type MaintenanceRepo } from './MaintenanceClient'

export const metadata: Metadata = {
  title: 'Maintenance',
  description: 'Repository for completed and maintenance projects',
}

const log = createModuleLogger('maintenance')

/**
 * One maintenance row with its comment embed. `projectinfo` is to-one (unique
 * constraint on `maintenance_id`) and null until the item gets its first note
 * or comment; generated types model it as an array, hence the override.
 */
type MaintenanceRow = Tables<'maintenance'> & {
  projectinfo: Pick<Tables<'projectinfo'>, 'comment' | 'comment_color'> | null
}

export default async function MaintenancePage() {
  const { supabase, claims } = await requireClaims()

  // Fetch maintenance repos with their comments in one embed, so cards render
  // their saved comment on first paint instead of flashing the empty state.
  const { data: maintenanceData, error } = await supabase
    .from('maintenance')
    .select('*, projectinfo(comment, comment_color)')
    .eq('user_id', claims.sub)
    .order('updated_at', { ascending: false })
    .overrideTypes<MaintenanceRow[], { merge: false }>()

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

  // One entry per repo — absent projectinfo (no info yet) still gets defaults,
  // so `comments[id].color` is never undefined downstream.
  const comments: Record<string, CommentData> = {}
  for (const item of maintenanceData || []) {
    const projectInfo = item.projectinfo
    comments[item.id] = projectInfo
      ? {
          comment: projectInfo.comment || '',
          color:
            (projectInfo.comment_color as CommentColor) ||
            DEFAULT_COMMENT_COLOR,
        }
      : { comment: '', color: DEFAULT_COMMENT_COLOR }
  }

  return <MaintenanceClient repos={repos} comments={comments} />
}

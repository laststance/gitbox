/**
 * Boards List Page (Home Screen)
 *
 * First screen after login
 * - Display all user boards with rename/delete actions
 * - Create new board
 */

import * as Sentry from '@sentry/nextjs'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { BoardGrid } from '@/components/Boards'
import { Button } from '@/components/ui/button'
import { requireClaims } from '@/lib/auth/require-claims'

import { BoardsPageHeader } from './BoardsPageHeader'

export const metadata: Metadata = {
  title: 'My Boards',
  description: 'Manage your GitHub repositories in Kanban format',
}

export default async function BoardsPage() {
  const { supabase, claims } = await requireClaims()

  // Fetch boards and user settings in parallel
  const [boardsResult, settingsResult] = await Promise.all([
    supabase
      .from('board')
      .select('*')
      .eq('user_id', claims.sub)
      .order('position', { ascending: true }),
    supabase
      .from('user_settings')
      .select('boards_page_title, boards_page_subtitle')
      .eq('user_id', claims.sub)
      .maybeSingle(),
  ])

  if (boardsResult.error) {
    Sentry.captureException(boardsResult.error, {
      extra: { context: 'Fetch boards list', userId: claims.sub },
    })
  }

  if (settingsResult.error) {
    Sentry.captureException(settingsResult.error, {
      extra: { context: 'Fetch user settings', userId: claims.sub },
    })
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <BoardsPageHeader
          initialTitle={settingsResult.data?.boards_page_title ?? null}
          initialSubtitle={settingsResult.data?.boards_page_subtitle ?? null}
        />

        {/* Create New Board Button */}
        <Button asChild>
          <Link href="/boards/new" className="gap-2">
            <Plus className="h-5 w-5" />
            Create Board
          </Link>
        </Button>
      </div>

      {/* Boards Grid with rename/delete support */}
      <BoardGrid initialBoards={boardsResult.data ?? []} />
    </div>
  )
}

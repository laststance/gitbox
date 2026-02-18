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
import { redirect } from 'next/navigation'

import { BoardGrid } from '@/components/Boards'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

import { BoardsPageHeader } from './BoardsPageHeader'

export const metadata: Metadata = {
  title: 'My Boards',
  description: 'Manage your GitHub repositories in Kanban format',
}

export default async function BoardsPage() {
  const supabase = await createClient()

  // Authentication check (also done in middleware, but double-check)
  // IMPORTANT: Use getUser() not getSession() for secure server-side validation
  // getSession() reads from cookies without verification, getUser() validates with Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch boards and user settings in parallel
  const [boardsResult, settingsResult] = await Promise.all([
    supabase
      .from('board')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true }),
    supabase
      .from('user_settings')
      .select('boards_page_title, boards_page_subtitle')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (boardsResult.error) {
    Sentry.captureException(boardsResult.error, {
      extra: { context: 'Fetch boards list', userId: user.id },
    })
  }

  if (settingsResult.error) {
    Sentry.captureException(settingsResult.error, {
      extra: { context: 'Fetch user settings', userId: user.id },
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

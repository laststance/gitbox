/**
 * Boards List Page (Home Screen)
 *
 * First screen after login
 * - Display all user boards with rename/delete actions
 * - Create new board
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BoardGrid } from '@/components/Boards'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

export default async function BoardsPage() {
  const supabase = await createClient()

  // Authentication check (also done in middleware, but double-check)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Fetch all user boards
  const { data: boards, error } = (await supabase
    .from('board')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })) as {
    data: Tables<'board'>[] | null
    error: Error | null
  }

  if (error) {
    console.error('Failed to fetch boards:', error)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Boards
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your GitHub repositories in Kanban format
          </p>
        </div>

        {/* Create New Board Button */}
        <Link
          href="/boards/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create Board
        </Link>
      </div>

      {/* Boards Grid with rename/delete support */}
      <BoardGrid initialBoards={boards ?? []} />
    </div>
  )
}

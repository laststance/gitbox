/**
 * Boards List Page (Home Screen)
 *
 * First screen after login
 * - Display all user boards
 * - Create new board
 * - Delete board
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
    .order('created_at', { ascending: false })) as { data: Tables<'board'>[] | null; error: any }

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

      {/* Boards Grid */}
      {boards && boards.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/board/${board.id}`}
              className="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
            >
              <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors">
                {board.name}
              </h3>
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {board.created_at ? new Date(board.created_at).toLocaleDateString('en-US') : 'N/A'}
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor:
                        board.theme === 'sunrise'
                          ? '#f59e0b'
                          : board.theme === 'midnight'
                            ? '#1e40af'
                            : '#6b7280',
                    }}
                  />
                  {board.theme}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 dark:border-gray-700 dark:bg-gray-800">
          <svg
            className="h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No boards yet
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first board
          </p>
          <Link
            href="/boards/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
      )}
    </div>
  )
}

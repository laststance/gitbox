/**
 * Favorites Page
 *
 * Displays boards marked as favorites for quick access.
 * Server component that fetches favorite boards from Supabase.
 */

import { Star } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BoardGrid } from '@/components/Boards'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

export default async function FavoritesPage() {
  const supabase = await createClient()

  // Authentication check (also done in middleware, but double-check)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  // Fetch favorite boards
  const { data: boards, error } = (await supabase
    .from('board')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('is_favorite', true)
    .order('updated_at', { ascending: false })) as {
    data: Tables<'board'>[] | null
    error: Error | null
  }

  if (error) {
    console.error('Failed to fetch favorite boards:', error)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Favorite Boards
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Your starred boards for quick access
          </p>
        </div>

        {/* Back to All Boards */}
        <Link
          href="/boards"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          View All Boards
        </Link>
      </div>

      {/* Empty State */}
      {(boards?.length ?? 0) === 0 ? (
        <FavoritesEmptyState />
      ) : (
        <BoardGrid initialBoards={boards ?? []} />
      )}
    </div>
  )
}

/**
 * Empty state component for when there are no favorite boards.
 */
function FavoritesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-16 dark:border-gray-700 dark:bg-gray-800">
      <div className="rounded-full bg-amber-100 p-4 dark:bg-amber-900/30">
        <Star className="h-10 w-10 text-amber-500 dark:text-amber-400" />
      </div>
      <h3 className="mt-6 text-xl font-medium text-gray-900 dark:text-white">
        No favorite boards yet
      </h3>
      <p className="mt-2 max-w-md text-center text-gray-500 dark:text-gray-400">
        Star boards from the All Boards page to add them here for quick access.
      </p>
      <Link
        href="/boards"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors"
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Go to All Boards
      </Link>
    </div>
  )
}

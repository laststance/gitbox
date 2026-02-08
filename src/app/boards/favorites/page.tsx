/**
 * Favorites Page
 *
 * Displays boards marked as favorites for quick access.
 * Server component that fetches favorite boards from Supabase.
 */

import { Star } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BoardGrid } from '@/components/Boards'
import { createModuleLogger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: 'Favorites',
  description: 'Your starred boards for quick access',
}

const log = createModuleLogger('favorites')

export default async function FavoritesPage() {
  const supabase = await createClient()

  // Authentication check (also done in middleware, but double-check)
  // IMPORTANT: Use getUser() not getSession() for secure server-side validation
  // getSession() reads from cookies without verification, getUser() validates with Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch favorite boards
  const { data: boards, error } = (await supabase
    .from('board')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_favorite', true)
    .order('updated_at', { ascending: false })) as {
    data: Tables<'board'>[] | null
    error: Error | null
  }

  if (error) {
    log.error({ error }, 'Failed to fetch favorite boards')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold">
            Favorite Boards
          </h1>
          <p className="text-muted-foreground mt-2">
            Your starred boards for quick access
          </p>
        </div>

        {/* Back to All Boards */}
        <Link
          href="/boards"
          className="border-input bg-background text-foreground hover:bg-accent focus:ring-primary inline-flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
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
    <div className="border-border bg-muted flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16">
      <div className="rounded-full bg-amber-100 p-4 dark:bg-amber-900/30">
        <Star className="h-10 w-10 text-amber-500 dark:text-amber-400" />
      </div>
      <h3 className="text-foreground mt-6 text-xl font-medium">
        No favorite boards yet
      </h3>
      <p className="text-muted-foreground mt-2 max-w-md text-center">
        Star boards from the All Boards page to add them here for quick access.
      </p>
      <Link
        href="/boards"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
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

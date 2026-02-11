/**
 * Boards List Page (Home Screen)
 *
 * First screen after login
 * - Display all user boards with rename/delete actions
 * - Create new board
 */

import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BoardGrid } from '@/components/Boards'
import { Button } from '@/components/ui/button'
import { createModuleLogger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: 'My Boards',
  description: 'Manage your GitHub repositories in Kanban format',
}

const log = createModuleLogger('boards')

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

  // Fetch all user boards
  const { data: boards, error } = (await supabase
    .from('board')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })) as {
    data: Tables<'board'>[] | null
    error: Error | null
  }

  if (error) {
    log.error({ error }, 'Failed to fetch boards')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold">My Boards</h1>
          <p className="text-muted-foreground mt-2">
            Manage your GitHub repositories in Kanban format
          </p>
        </div>

        {/* Create New Board Button */}
        <Button asChild>
          <Link href="/boards/new" className="gap-2">
            <Plus className="h-5 w-5" />
            Create Board
          </Link>
        </Button>
      </div>

      {/* Boards Grid with rename/delete support */}
      <BoardGrid initialBoards={boards ?? []} />
    </div>
  )
}

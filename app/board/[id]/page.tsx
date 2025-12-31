/**
 * Board Detail Page
 *
 * Displays individual Kanban board
 * - Fetches board information from Supabase
 * - Fetches initial board data (statusLists, repoCards, comments)
 * - Renders KanbanBoard component with server-fetched data
 *
 * Phase 4 Refactoring:
 * Data is now fetched in this Server Component and passed to
 * BoardPageClient, eliminating the child-to-parent data flow
 * anti-pattern in KanbanBoard.
 */

import { type Metadata } from 'next'
import { notFound } from 'next/navigation'

import { fetchBoardInitialData } from '@/lib/actions/board-data'
import { createClient } from '@/lib/supabase/server'

import { BoardPageClient } from './BoardPageClient'

export interface BoardPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * generateMetadata
 *
 * Sets board name as page title
 */
export async function generateMetadata(
  props: BoardPageProps,
): Promise<Metadata> {
  const params = await props.params
  const supabase = await createClient()

  const { data: board } = await supabase
    .from('board')
    .select('name')
    .eq('id', params.id)
    .single<{ name: string }>()

  return {
    title: board?.name ? `${board.name} | GitBox` : 'Board | GitBox',
  }
}

/**
 * BoardPage
 *
 * Kanban board detail page
 * - Returns 404 if board does not exist
 * - User authentication check (already done in middleware.ts)
 * - Applies theme from board settings
 * - Fetches initial board data (Phase 4: Server Component pattern)
 */
export default async function BoardPage(props: BoardPageProps) {
  const params = await props.params
  const supabase = await createClient()

  // Fetch board information
  const { data: board, error: boardError } = await supabase
    .from('board')
    .select('*')
    .eq('id', params.id)
    .single()

  // Return 404 if board does not exist or user lacks access permission
  if (boardError || !board) {
    notFound()
  }

  // Phase 4: Fetch initial data in Server Component
  // This eliminates the child-to-parent data flow anti-pattern
  const initialData = await fetchBoardInitialData(params.id)

  return <BoardPageClient board={board} initialData={initialData} />
}

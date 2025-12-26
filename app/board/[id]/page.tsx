/**
 * Board Detail Page
 *
 * Displays individual Kanban board
 * - Fetches board information from Supabase
 * - Renders KanbanBoard component
 */

import { type Metadata } from 'next'
import { notFound } from 'next/navigation'

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
 */
export default async function BoardPage(props: BoardPageProps) {
  const params = await props.params
  const supabase = await createClient()

  console.log('[DEBUG] BoardPage params:', params)
  console.log('[DEBUG] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  // Fetch board information
  const { data: board, error: boardError } = await supabase
    .from('board')
    .select('*')
    .eq('id', params.id)
    .single<{
      id: string
      name: string
      theme: string | null
      settings: Record<string, unknown> | null
    }>()

  console.log('[DEBUG] Board query result:', { board, boardError })

  // Return 404 if board does not exist or user lacks access permission
  if (boardError || !board) {
    console.error('[DEBUG] Board not found or error:', boardError)
    notFound()
  }

  return (
    <BoardPageClient
      boardId={board.id}
      boardName={board.name}
      boardTheme={board.theme}
    />
  )
}

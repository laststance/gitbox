/**
 * Board Detail Page
 *
 * 個別Kanbanボードを表示
 * - ボード情報をSupabaseからフェッチ
 * - KanbanBoardコンポーネントをレンダリング
 */

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
 * ボード名をページタイトルに設定
 */
export async function generateMetadata(props: BoardPageProps) {
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
 * Kanbanボード詳細ページ
 * - ボードが存在しない場合は404
 * - ユーザー認証チェック (middleware.tsで実施済み)
 * - テーマをボード設定から適用
 */
export default async function BoardPage(props: BoardPageProps) {
  const params = await props.params
  const supabase = await createClient()

  console.log('[DEBUG] BoardPage params:', params)
  console.log('[DEBUG] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  // ボード情報を取得
  const { data: board, error: boardError } = await supabase
    .from('board')
    .select('*')
    .eq('id', params.id)
    .single<{ id: string; name: string; theme: string | null; settings: Record<string, unknown> | null }>()

  console.log('[DEBUG] Board query result:', { board, boardError })

  // ボードが存在しない、またはアクセス権限がない場合は404
  if (boardError || !board) {
    console.error('[DEBUG] Board not found or error:', boardError)
    notFound()
  }

  return <BoardPageClient boardId={board.id} boardName={board.name} />
}

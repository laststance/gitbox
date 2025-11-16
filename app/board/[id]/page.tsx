/**
 * Board Detail Page
 *
 * 個別Kanbanボードを表示
 * - ボード情報をSupabaseからフェッチ
 * - KanbanBoardコンポーネントをレンダリング
 */

import { notFound } from 'next/navigation'
import { KanbanBoard } from '@/components/Board/KanbanBoard'
import { createClient } from '@/lib/supabase/server'

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
    .from('Board')
    .select('name')
    .eq('id', params.id)
    .single()

  return {
    title: board?.name ? `${board.name} | Vibe Rush` : 'Board | Vibe Rush',
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

  // ボード情報を取得
  const { data: board, error: boardError } = await supabase
    .from('Board')
    .select('*')
    .eq('id', params.id)
    .single()

  // ボードが存在しない、またはアクセス権限がない場合は404
  if (boardError || !board) {
    notFound()
  }

  return (
    <main className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {board.name}
          </h1>

          {/* ボード設定ボタン (将来的に実装) */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Board Settings
            </button>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
        <KanbanBoard
          boardId={board.id}
          onEditProjectInfo={(cardId) => {
            // TODO: Project Infoモーダルを開く (User Story 4で実装)
            console.log('Edit Project Info:', cardId)
          }}
          onMoveToMaintenance={(cardId) => {
            // TODO: Maintenance Modeへ移動 (User Story 6で実装)
            console.log('Move to Maintenance:', cardId)
          }}
        />
      </div>
    </main>
  )
}

/**
 * Board Data Actions
 *
 * ボードのStatusListとRepoCardをSupabaseから取得・更新するサーバーアクション
 * KanbanBoardコンポーネントで使用
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  StatusListDomain,
  RepoCardDomain,
  RepoCardMeta,
} from '@/lib/models/domain'

/**
 * ボードのStatusListを取得
 *
 * @param boardId - ボードID
 * @returns StatusList配列（order順）
 */
export async function getStatusLists(
  boardId: string,
): Promise<{ success: boolean; data?: StatusListDomain[]; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: statusLists, error } = await supabase
      .from('statuslist')
      .select('*')
      .eq('board_id', boardId)
      .order('order', { ascending: true })

    if (error) {
      console.error('Failed to fetch status lists:', error)
      return { success: false, error: error.message }
    }

    // DBの型をドメイン型にマッピング
    const mapped: StatusListDomain[] = (statusLists || []).map((sl) => ({
      id: sl.id,
      title: sl.name,
      wipLimit: sl.wip_limit ?? 0,
      color: sl.color ?? '#6B7280',
      order: sl.order,
      boardId: sl.board_id,
      createdAt: sl.created_at ?? new Date().toISOString(),
      updatedAt: sl.updated_at ?? new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Get status lists error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ボードのRepoCardを取得
 *
 * @param boardId - ボードID
 * @returns RepoCard配列（order順）
 */
export async function getRepoCards(
  boardId: string,
): Promise<{ success: boolean; data?: RepoCardDomain[]; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: repoCards, error } = await supabase
      .from('repocard')
      .select('*')
      .eq('board_id', boardId)
      .order('order', { ascending: true })

    if (error) {
      console.error('Failed to fetch repo cards:', error)
      return { success: false, error: error.message }
    }

    // DBの型をドメイン型にマッピング
    const mapped: RepoCardDomain[] = (repoCards || []).map((rc) => ({
      id: rc.id,
      title: rc.repo_name,
      description:
        (rc.meta as RepoCardMeta)?.description ?? rc.note ?? undefined,
      statusId: rc.status_id,
      boardId: rc.board_id,
      repoOwner: rc.repo_owner,
      repoName: rc.repo_name,
      note: rc.note,
      order: rc.order,
      meta: (rc.meta as RepoCardMeta) ?? {},
      createdAt: rc.created_at ?? new Date().toISOString(),
      updatedAt: rc.updated_at ?? new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Get repo cards error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ボードのStatusListとRepoCardを一括取得
 *
 * @param boardId - ボードID
 * @returns StatusListとRepoCardの配列
 */
export async function getBoardData(boardId: string): Promise<{
  success: boolean
  statusLists?: StatusListDomain[]
  repoCards?: RepoCardDomain[]
  error?: string
}> {
  try {
    const [statusResult, cardsResult] = await Promise.all([
      getStatusLists(boardId),
      getRepoCards(boardId),
    ])

    if (!statusResult.success) {
      return { success: false, error: statusResult.error }
    }

    if (!cardsResult.success) {
      return { success: false, error: cardsResult.error }
    }

    return {
      success: true,
      statusLists: statusResult.data,
      repoCards: cardsResult.data,
    }
  } catch (error) {
    console.error('Get board data error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * デフォルトのStatusListを作成
 * 新規ボード作成時に呼び出される
 *
 * @param boardId - ボードID
 * @returns 作成されたStatusList配列
 */
export async function createDefaultStatusLists(
  boardId: string,
): Promise<{ success: boolean; data?: StatusListDomain[]; error?: string }> {
  try {
    const supabase = await createClient()

    const defaultStatuses = [
      { name: 'Suspend', color: '#8B7355', order: 0 },
      { name: 'Spec designing', color: '#6B8E23', order: 1 },
      { name: 'Active', color: '#CD853F', order: 2 },
      { name: 'Completed', color: '#556B2F', order: 3 },
    ]

    const { data, error } = await supabase
      .from('statuslist')
      .insert(
        defaultStatuses.map((status) => ({
          board_id: boardId,
          ...status,
        })),
      )
      .select()

    if (error) {
      console.error('Failed to create default status lists:', error)
      return { success: false, error: error.message }
    }

    // DBの型をドメイン型にマッピング
    const mapped: StatusListDomain[] = (data || []).map((sl) => ({
      id: sl.id,
      title: sl.name,
      wipLimit: sl.wip_limit ?? 0,
      color: sl.color ?? '#6B7280',
      order: sl.order,
      boardId: sl.board_id,
      createdAt: sl.created_at ?? new Date().toISOString(),
      updatedAt: sl.updated_at ?? new Date().toISOString(),
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('Create default status lists error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * RepoCardのステータスと順序を更新（D&D後）
 *
 * @param cardId - カードID
 * @param statusId - 新しいステータスID
 * @param order - 新しい順序
 * @returns 更新結果
 */
export async function updateCardPosition(
  cardId: string,
  statusId: string,
  order: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('repocard')
      .update({
        status_id: statusId,
        order: order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)

    if (error) {
      console.error('Failed to update card position:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Update card position error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 複数カードの順序を一括更新（D&D後の並べ替え）
 *
 * @param updates - カードIDと新しい順序のペア配列
 * @returns 更新結果
 */
export async function updateCardsOrder(
  updates: { id: string; statusId: string; order: number }[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // 各カードを順番に更新（トランザクションの代わり）
    for (const update of updates) {
      const { error } = await supabase
        .from('repocard')
        .update({
          status_id: update.statusId,
          order: update.order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id)

      if (error) {
        console.error('Failed to update card order:', error)
        return { success: false, error: error.message }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update cards order error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 新規ボードを作成
 *
 * @param userId - ユーザーID
 * @param name - ボード名
 * @param theme - テーマ
 * @returns 作成されたボードID
 */
export async function createBoard(
  userId: string,
  name: string,
  theme: string = 'sunrise',
): Promise<{ success: boolean; boardId?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // ボードを作成
    const { data: board, error: boardError } = await supabase
      .from('board')
      .insert({
        user_id: userId,
        name: name,
        theme: theme,
        settings: {},
      })
      .select('id')
      .single()

    if (boardError) {
      console.error('Failed to create board:', boardError)
      return { success: false, error: boardError.message }
    }

    // デフォルトのStatusListを作成
    const defaultResult = await createDefaultStatusLists(board.id)
    if (!defaultResult.success) {
      console.error(
        'Failed to create default status lists:',
        defaultResult.error,
      )
      // ボードは作成されているので、エラーを表示しつつも成功とする
    }

    return { success: true, boardId: board.id }
  } catch (error) {
    console.error('Create board error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ボードを削除
 *
 * @param boardId - ボードID
 * @returns 削除結果
 */
export async function deleteBoard(
  boardId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from('board').delete().eq('id', boardId)

    if (error) {
      console.error('Failed to delete board:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete board error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

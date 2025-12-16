/**
 * RepoCard Actions
 *
 * サーバーアクションで RepoCard（GitHub Repository カード）の CRUD 操作を実行
 * - Repository を Board に追加
 * - 重複チェック
 * - Quick note 更新
 * - カード削除
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import type { GitHubRepository } from '@/lib/github/api'

/**
 * RepoCard 追加パラメータ
 */
export interface AddRepoCardParams {
  boardId: string
  statusId: string
  repository: {
    owner: string
    name: string
    description?: string | null
    stars?: number
    language?: string | null
    topics?: string[]
    visibility?: 'public' | 'private'
    updatedAt?: string
  }
  order?: number
}

/**
 * 複数の Repository を Board に追加
 *
 * @param boardId - 追加先のボード ID
 * @param statusId - 初期ステータス（列） ID
 * @param repositories - 追加する GitHub Repository のリスト
 * @returns 追加されたカードの数
 */
export async function addRepositoriesToBoard(
  boardId: string,
  statusId: string,
  repositories: GitHubRepository[]
): Promise<{ success: boolean; addedCount: number; errors?: string[] }> {
  try {
    const supabase = await createClient()

    // 現在のユーザーを取得
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('認証が必要です')
    }

    // Board が存在し、ユーザーが所有しているか確認
    const { data: board, error: boardError } = await supabase
      .from('board')
      .select('id, user_id')
      .eq('id', boardId)
      .eq('user_id', user.id)
      .single()

    if (boardError || !board) {
      throw new Error('Board が見つかりません')
    }

    // 既存のカードを取得して重複チェック
    const { data: existingCards, error: existingError } = await supabase
      .from('repocard')  // 小文字に変更
      .select('repo_owner, repo_name')
      .eq('board_id', boardId)

    if (existingError) {
      throw new Error('既存カードの取得に失敗しました')
    }

    const existingRepoKeys = new Set(
      existingCards?.map(card => `${card.repo_owner}/${card.repo_name}`) || []
    )

    // 重複していないリポジトリのみフィルター
    const newRepos = repositories.filter(repo => {
      const key = `${repo.owner.login}/${repo.name}`
      return !existingRepoKeys.has(key)
    })

    if (newRepos.length === 0) {
      return {
        success: false,
        addedCount: 0,
        errors: ['すべてのリポジトリが既に追加されています'],
      }
    }

    // 現在の最大 order 値を取得
    const { data: maxOrderData } = await supabase
      .from('repocard')  // 小文字に変更
      .select('order')
      .eq('status_id', statusId)
      .order('order', { ascending: false })
      .limit(1)
      .single()

    let nextOrder = (maxOrderData?.order ?? -1) + 1

    // 新しいカードを追加
    const cardsToInsert = newRepos.map(repo => ({
      board_id: boardId,
      status_id: statusId,
      repo_owner: repo.owner.login,
      repo_name: repo.name,
      note: '',
      order: nextOrder++,
      meta: {
        stars: repo.stargazers_count,
        language: repo.language,
        topics: repo.topics || [],
        visibility: repo.visibility,
        description: repo.description,
        updatedAt: repo.updated_at,
      },
    }))

    const { error: insertError } = await supabase.from('repocard').insert(cardsToInsert)

    if (insertError) {
      console.error('RepoCard insert error:', insertError)
      throw new Error('カードの追加に失敗しました: ' + insertError.message)
    }

    const duplicateCount = repositories.length - newRepos.length

    return {
      success: true,
      addedCount: newRepos.length,
      errors: duplicateCount > 0 ? [`${duplicateCount}件のリポジトリが重複していました`] : undefined,
    }
  } catch (error) {
    console.error('Add repositories error:', error)
    return {
      success: false,
      addedCount: 0,
      errors: [error instanceof Error ? error.message : '不明なエラーが発生しました'],
    }
  }
}

/**
 * Repository が既に Board に追加されているかチェック
 *
 * @param boardId - ボード ID
 * @param repoOwner - Repository owner
 * @param repoName - Repository name
 * @returns 重複している場合 true
 */
export async function checkDuplicateRepository(
  boardId: string,
  repoOwner: string,
  repoName: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('repocard')
      .select('id')
      .eq('board_id', boardId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName)
      .maybeSingle()

    if (error) {
      console.error('Check duplicate error:', error)
      return false
    }

    return data !== null
  } catch (error) {
    console.error('Check duplicate error:', error)
    return false
  }
}

/**
 * RepoCard の Quick note を更新
 *
 * @param cardId - カード ID
 * @param note - 新しい note（最大300文字）
 * @returns 更新成功フラグ
 */
export async function updateRepoCardNote(
  cardId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (note.length > 300) {
      return {
        success: false,
        error: 'Note は最大300文字までです',
      }
    }

    const supabase = await createClient()

    // 現在のユーザーを取得
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: '認証が必要です',
      }
    }

    // カードを更新（RLS ポリシーで自動的に所有チェック）
    const { error: updateError } = await supabase
      .from('repocard')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('id', cardId)

    if (updateError) {
      console.error('Update note error:', updateError)
      return {
        success: false,
        error: 'Note の更新に失敗しました',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update note error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました',
    }
  }
}

/**
 * RepoCard を削除
 *
 * @param cardId - カード ID
 * @returns 削除成功フラグ
 */
export async function deleteRepoCard(cardId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // 現在のユーザーを取得
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: '認証が必要です',
      }
    }

    // カードを削除（RLS ポリシーで自動的に所有チェック）
    const { error: deleteError } = await supabase.from('repocard').delete().eq('id', cardId)

    if (deleteError) {
      console.error('Delete card error:', deleteError)
      return {
        success: false,
        error: 'カードの削除に失敗しました',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete card error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました',
    }
  }
}

/**
 * RepoCard の order（並び順）を更新
 *
 * @param cardId - カード ID
 * @param statusId - 新しいステータス ID（列移動の場合）
 * @param newOrder - 新しい order 値
 * @returns 更新成功フラグ
 */
export async function updateRepoCardOrder(
  cardId: string,
  statusId: string,
  newOrder: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // 現在のユーザーを取得
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: '認証が必要です',
      }
    }

    // カードを更新（RLS ポリシーで自動的に所有チェック）
    const { error: updateError } = await supabase
      .from('repocard')
      .update({
        status_id: statusId,
        order: newOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)

    if (updateError) {
      console.error('Update order error:', updateError)
      return {
        success: false,
        error: 'カードの移動に失敗しました',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update order error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました',
    }
  }
}

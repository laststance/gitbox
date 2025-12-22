/**
 * RepoCard Actions
 *
 * Execute RepoCard (GitHub Repository Card) CRUD operations with server actions
 * - Add repository to board
 * - Check duplicates
 * - Update quick note
 * - Delete card
 */

'use server'

import type { GitHubRepository } from '@/lib/actions/github'
import { createClient } from '@/lib/supabase/server'

/**
 * RepoCard addition parameters
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
 * Add multiple repositories to board
 *
 * @param boardId - Target board ID
 * @param statusId - Initial status (column) ID
 * @param repositories - List of GitHub repositories to add
 * @returns Number of cards added
 */
export async function addRepositoriesToBoard(
  boardId: string,
  statusId: string,
  repositories: GitHubRepository[],
): Promise<{ success: boolean; addedCount: number; errors?: string[] }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Authentication required')
    }

    // Check if board exists and user owns it
    const { data: board, error: boardError } = await supabase
      .from('board')
      .select('id, user_id')
      .eq('id', boardId)
      .eq('user_id', user.id)
      .single()

    if (boardError || !board) {
      throw new Error('Board not found')
    }

    // Get existing cards and check for duplicates
    const { data: existingCards, error: existingError } = await supabase
      .from('repocard')
      .select('repo_owner, repo_name')
      .eq('board_id', boardId)

    if (existingError) {
      throw new Error('Failed to fetch existing cards')
    }

    const existingRepoKeys = new Set(
      existingCards?.map((card) => `${card.repo_owner}/${card.repo_name}`) ||
        [],
    )

    // Filter to only non-duplicate repositories
    const newRepos = repositories.filter((repo) => {
      const key = `${repo.owner.login}/${repo.name}`
      return !existingRepoKeys.has(key)
    })

    if (newRepos.length === 0) {
      return {
        success: false,
        addedCount: 0,
        errors: ['All repositories have already been added'],
      }
    }

    // Get current maximum order value
    const { data: maxOrderData } = await supabase
      .from('repocard')
      .select('order')
      .eq('status_id', statusId)
      .order('order', { ascending: false })
      .limit(1)
      .single()

    let nextOrder = (maxOrderData?.order ?? -1) + 1

    // Add new cards
    const cardsToInsert = newRepos.map((repo) => ({
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

    const { error: insertError } = await supabase
      .from('repocard')
      .insert(cardsToInsert)

    if (insertError) {
      console.error('RepoCard insert error:', insertError)
      throw new Error('Failed to add cards: ' + insertError.message)
    }

    const duplicateCount = repositories.length - newRepos.length

    return {
      success: true,
      addedCount: newRepos.length,
      errors:
        duplicateCount > 0
          ? [`${duplicateCount} repositories were duplicates`]
          : undefined,
    }
  } catch (error) {
    console.error('Add repositories error:', error)
    return {
      success: false,
      addedCount: 0,
      errors: [
        error instanceof Error ? error.message : 'Unknown error occurred',
      ],
    }
  }
}

/**
 * Check if repository is already added to board
 *
 * @param boardId - Board ID
 * @param repoOwner - Repository owner
 * @param repoName - Repository name
 * @returns True if duplicate
 */
export async function checkDuplicateRepository(
  boardId: string,
  repoOwner: string,
  repoName: string,
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
 * Update RepoCard quick note
 *
 * @param cardId - Card ID
 * @param note - New note (max 300 characters)
 * @returns Update success flag
 */
export async function updateRepoCardNote(
  cardId: string,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (note.length > 300) {
      return {
        success: false,
        error: 'Note must be 300 characters or less',
      }
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Update card (ownership check is done automatically by RLS policy)
    const { error: updateError } = await supabase
      .from('repocard')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('id', cardId)

    if (updateError) {
      console.error('Update note error:', updateError)
      return {
        success: false,
        error: 'Failed to update note',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update note error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Delete RepoCard
 *
 * @param cardId - Card ID
 * @returns Deletion success flag
 */
export async function deleteRepoCard(
  cardId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Delete card (ownership check is done automatically by RLS policy)
    const { error: deleteError } = await supabase
      .from('repocard')
      .delete()
      .eq('id', cardId)

    if (deleteError) {
      console.error('Delete card error:', deleteError)
      return {
        success: false,
        error: 'Failed to delete card',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete card error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Update RepoCard order (sort order)
 *
 * @param cardId - Card ID
 * @param statusId - New status ID (when moving columns)
 * @param newOrder - New order value
 * @returns Update success flag
 */
export async function updateRepoCardOrder(
  cardId: string,
  statusId: string,
  newOrder: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required',
      }
    }

    // Update card (ownership check is done automatically by RLS policy)
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
        error: 'Failed to move card',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Update order error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

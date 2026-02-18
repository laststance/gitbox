'use server'

import * as Sentry from '@sentry/nextjs'

import {
  boardsPageSubtitleSchema,
  boardsPageTitleSchema,
} from '@/lib/validations/user-settings'

import { withAuthResultRateLimit } from './auth-guard'
import type { ActionResult } from './types'

/**
 * Updates the boards page title for the current user.
 * Uses upsert to create the user_settings row on first edit.
 * Empty string is stored as NULL (reverts to default on next load).
 *
 * @param title - The new title to save
 * @returns ActionResult with the saved title
 * @example
 * const result = await updateBoardsPageTitle('My Projects')
 * // => { success: true, data: { title: 'My Projects' } }
 *
 * const result = await updateBoardsPageTitle('')
 * // => { success: true, data: { title: '' } } (stored as NULL in DB)
 */
export async function updateBoardsPageTitle(
  title: string,
): Promise<ActionResult<{ title: string }>> {
  const titleResult = boardsPageTitleSchema.safeParse(title)
  if (!titleResult.success) {
    return {
      success: false,
      error: titleResult.error.issues[0]?.message || 'Invalid title',
    }
  }

  // Store empty string as null in DB for cleaner querying
  const dbValue = titleResult.data === '' ? null : titleResult.data

  return withAuthResultRateLimit('userSettings', async (supabase, user) => {
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: user.id,
        boards_page_title: dbValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update boards page title', userId: user.id },
      })
      throw new Error('Failed to update title')
    }

    return { title: titleResult.data }
  })
}

/**
 * Updates the boards page subtitle for the current user.
 * Uses upsert to create the user_settings row on first edit.
 * Empty string is stored as NULL (reverts to default on next load).
 *
 * @param subtitle - The new subtitle to save
 * @returns ActionResult with the saved subtitle
 * @example
 * const result = await updateBoardsPageSubtitle('Track my open-source work')
 * // => { success: true, data: { subtitle: 'Track my open-source work' } }
 */
export async function updateBoardsPageSubtitle(
  subtitle: string,
): Promise<ActionResult<{ subtitle: string }>> {
  const subtitleResult = boardsPageSubtitleSchema.safeParse(subtitle)
  if (!subtitleResult.success) {
    return {
      success: false,
      error: subtitleResult.error.issues[0]?.message || 'Invalid subtitle',
    }
  }

  // Store empty string as null in DB for cleaner querying
  const dbValue = subtitleResult.data === '' ? null : subtitleResult.data

  return withAuthResultRateLimit('userSettings', async (supabase, user) => {
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: user.id,
        boards_page_subtitle: dbValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update boards page subtitle', userId: user.id },
      })
      throw new Error('Failed to update subtitle')
    }

    return { subtitle: subtitleResult.data }
  })
}

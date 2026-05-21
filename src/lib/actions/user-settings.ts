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
 * @example
 * const result = await updateBoardsPageTitle('My Projects')
 * // => { success: true, data: { title: 'My Projects' } }
 */
export async function updateBoardsPageTitle(
  title: string,
): Promise<ActionResult<{ title: string }>> {
  const parsed = boardsPageTitleSchema.safeParse(title)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid title',
    }
  }

  // Store empty string as null in DB for cleaner querying
  const dbValue = parsed.data === '' ? null : parsed.data

  return withAuthResultRateLimit('userSettings', async (supabase, claims) => {
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: claims.sub,
        boards_page_title: dbValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update boards page title', userId: claims.sub },
      })
      throw new Error('Failed to update title')
    }

    return { title: parsed.data }
  })
}

/**
 * Updates the boards page subtitle for the current user.
 * Uses upsert to create the user_settings row on first edit.
 * Empty string is stored as NULL (reverts to default on next load).
 *
 * @example
 * const result = await updateBoardsPageSubtitle('Track my open-source work')
 * // => { success: true, data: { subtitle: 'Track my open-source work' } }
 */
export async function updateBoardsPageSubtitle(
  subtitle: string,
): Promise<ActionResult<{ subtitle: string }>> {
  const parsed = boardsPageSubtitleSchema.safeParse(subtitle)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid subtitle',
    }
  }

  // Store empty string as null in DB for cleaner querying
  const dbValue = parsed.data === '' ? null : parsed.data

  return withAuthResultRateLimit('userSettings', async (supabase, claims) => {
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: claims.sub,
        boards_page_subtitle: dbValue,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (error) {
      Sentry.captureException(error, {
        extra: { context: 'Update boards page subtitle', userId: claims.sub },
      })
      throw new Error('Failed to update subtitle')
    }

    return { subtitle: parsed.data }
  })
}
